package repoqueue

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"codecv/backend/internal/model"
	"codecv/backend/internal/reporeview"
	"codecv/backend/internal/store"
)

type fakeStore struct {
	job model.RepositoryJob

	mu         sync.Mutex
	claimed    bool
	reset      bool
	backfilled bool
	finished   bool
	status     string
	context    string
	detail     string
	tree       []model.RepoTreeNode
	details    *model.RepoDetails
	summary    *model.RepoSummary
	done       chan struct{}

	primary        string
	findingsState  string
	findingsDetail string
	findingsRepo   string
	findingsSaved  []model.Finding
	findingsDone   chan struct{}
	models         []model.AIModel
}

func (f *fakeStore) ServiceConfig(context.Context, string) (model.ServiceConfig, error) {
	return model.ServiceConfig{}, store.ErrNotFound
}

func (f *fakeStore) PendingRepositoryJob(context.Context) (model.RepositoryJob, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.claimed {
		return model.RepositoryJob{}, false, nil
	}
	f.claimed = true
	return f.job, true, nil
}

func (f *fakeStore) FinishRepositoryJob(
	_ context.Context,
	_ model.RepositoryJob,
	status, contextText, detail string,
	tree []model.RepoTreeNode,
	details *model.RepoDetails,
	summary *model.RepoSummary,
) error {
	f.mu.Lock()
	f.finished = true
	f.status = status
	f.context = contextText
	f.detail = detail
	f.tree = tree
	f.details = details
	f.summary = summary
	f.mu.Unlock()
	close(f.done)
	return nil
}

func (f *fakeStore) ResetAnalyzingRepositories(context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.reset = true
	return nil
}

func (f *fakeStore) BackfillRepositorySummaries(context.Context) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.backfilled = true
	return 0, nil
}

func (f *fakeStore) PrimaryRepositoryURL(context.Context, string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.primary, nil
}

func (f *fakeStore) StartRepositoryFindings(context.Context, string, int) (bool, error) {
	return true, nil
}

func (f *fakeStore) SetRepositoryFindingsState(_ context.Context, _ string, _ int, state, detail string) error {
	f.mu.Lock()
	f.findingsState = state
	f.findingsDetail = detail
	done := f.findingsDone
	f.mu.Unlock()
	if done != nil {
		select {
		case done <- struct{}{}:
		default:
		}
	}
	return nil
}

func (f *fakeStore) SaveRepositoryFindings(_ context.Context, _ string, repoURL string, findings []model.Finding) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.findingsRepo = repoURL
	f.findingsSaved = findings
	return nil
}

func (f *fakeStore) ActiveModels(context.Context) ([]model.AIModel, error) {
	if len(f.models) > 0 {
		return f.models, nil
	}
	return []model.AIModel{{ID: "gemini-test", Name: "Gemini", Provider: "Google", Active: true}}, nil
}

type fakeReviewer struct {
	called   bool
	files    []string
	findings []model.Finding
	err      error
	models   []string
	errs     map[string]error
}

func (r *fakeReviewer) ReviewRepository(_ context.Context, modelID string, in reporeview.Input) ([]model.Finding, error) {
	r.called = true
	r.models = append(r.models, modelID)
	r.files = make([]string, 0, len(in.Files))
	for _, file := range in.Files {
		r.files = append(r.files, file.Path)
	}
	if err, ok := r.errs[modelID]; ok {
		return nil, err
	}
	return r.findings, r.err
}

type unavailableError struct{ message string }

func (e unavailableError) Error() string { return e.message }

func (e unavailableError) ModelUnavailable() bool { return true }

func TestWorkerReadsPendingRepository(t *testing.T) {
	githubServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/repos/octo/demo":
			fmt.Fprint(w, `{"name":"demo","full_name":"octo/demo","description":"A tiny repo","language":"Go","stargazers_count":3,"forks_count":1,"default_branch":"main","pushed_at":"2026-01-02T03:04:05Z"}`)
		case r.URL.Path == "/repos/octo/demo/languages":
			fmt.Fprint(w, `{"Go":1200}`)
		case r.URL.Path == "/repos/octo/demo/readme":
			fmt.Fprint(w, "# Demo\nA tiny repository.")
		case r.URL.Path == "/repos/octo/demo/contents":
			fmt.Fprint(w, `[{"name":"main.go","type":"file"},{"name":"cmd","type":"dir"}]`)
		case r.URL.Path == "/repos/octo/demo/commits":
			fmt.Fprint(w, `[{"sha":"abcdef1234567890","commit":{"message":"init","author":{"date":"2026-01-02T03:04:05Z"}}}]`)
		case r.URL.Path == "/repos/octo/demo/git/trees/main":
			if r.URL.Query().Get("recursive") != "1" {
				http.NotFound(w, r)
				return
			}
			fmt.Fprint(w, `{"truncated":false,"tree":[
				{"path":"cmd","type":"tree","sha":"t1"},
				{"path":"cmd/app","type":"tree","sha":"t2"},
				{"path":"cmd/app/main.go","type":"blob","sha":"b1","size":120},
				{"path":"main.go","type":"blob","sha":"b2","size":80},
				{"path":"node_modules","type":"tree","sha":"t3"},
				{"path":"node_modules/lib/index.js","type":"blob","sha":"b3","size":40}
			]}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer githubServer.Close()

	dataStore := &fakeStore{
		job:  model.RepositoryJob{CandidateID: "candidate-1", Index: 0, URL: "https://github.com/octo/demo", Owner: "octo", Name: "demo"},
		done: make(chan struct{}),
	}
	worker := New(dataStore)
	worker.githubBaseURL = githubServer.URL
	worker.idle = 5 * time.Millisecond
	worker.throttle = time.Millisecond
	worker.jobTimeout = 5 * time.Second

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		worker.Run(ctx)
		close(runDone)
	}()

	select {
	case <-dataStore.done:
	case <-time.After(3 * time.Second):
		t.Fatal("worker did not finish the repository in time")
	}
	cancel()
	<-runDone

	dataStore.mu.Lock()
	defer dataStore.mu.Unlock()
	if !dataStore.reset {
		t.Fatal("worker did not reset analyzing repositories on start")
	}
	if !dataStore.backfilled {
		t.Fatal("worker did not backfill repository summaries on start")
	}
	if !dataStore.finished {
		t.Fatal("worker did not persist the result")
	}
	if dataStore.status != model.RepositoryAnalyzed {
		t.Fatalf("status = %q, want %q", dataStore.status, model.RepositoryAnalyzed)
	}
	if !strings.Contains(dataStore.context, "Go") || !strings.Contains(dataStore.context, "3★") {
		t.Fatalf("context = %q, want language and stars", dataStore.context)
	}
	if !strings.Contains(dataStore.detail, "Đã đọc repo") {
		t.Fatalf("detail = %q, want read confirmation", dataStore.detail)
	}
	if len(dataStore.tree) == 0 {
		t.Fatal("worker did not persist the repository tree")
	}
	if dataStore.details == nil || dataStore.details.FileCount != 2 {
		t.Fatalf("details = %+v, want two files (node_modules ignored)", dataStore.details)
	}
	if dataStore.details.DefaultBranch != "main" || len(dataStore.details.Commits) != 1 {
		t.Fatalf("details = %+v, want branch and commits", dataStore.details)
	}
	if dataStore.summary == nil || dataStore.summary.Files != 2 || len(dataStore.summary.Modules) == 0 {
		t.Fatalf("summary = %+v, want two files and one module", dataStore.summary)
	}
	if dataStore.summary.Flags == nil {
		t.Fatal("summary flags should not be nil")
	}
}

func TestWorkerMarksUnreadableRepositoryUnavailable(t *testing.T) {
	githubServer := httptest.NewServer(http.NotFoundHandler())
	defer githubServer.Close()

	dataStore := &fakeStore{
		job:  model.RepositoryJob{CandidateID: "candidate-2", Index: 1, URL: "https://github.com/octo/missing", Owner: "octo", Name: "missing"},
		done: make(chan struct{}),
	}
	worker := New(dataStore)
	worker.githubBaseURL = githubServer.URL
	worker.idle = 5 * time.Millisecond
	worker.throttle = time.Millisecond
	worker.jobTimeout = 5 * time.Second

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		worker.Run(ctx)
		close(runDone)
	}()

	select {
	case <-dataStore.done:
	case <-time.After(3 * time.Second):
		t.Fatal("worker did not finish the missing repository in time")
	}
	cancel()
	<-runDone

	dataStore.mu.Lock()
	defer dataStore.mu.Unlock()
	if dataStore.status != model.RepositoryUnavailable {
		t.Fatalf("status = %q, want %q", dataStore.status, model.RepositoryUnavailable)
	}
	if !strings.Contains(dataStore.detail, "Không tìm thấy repo") {
		t.Fatalf("detail = %q, want not-found message", dataStore.detail)
	}
}

func TestWorkerReviewsQueuedRepositoryFindings(t *testing.T) {
	githubServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/repos/octo/demo/git/blobs/b1" {
			fmt.Fprint(w, "package main\n\nfunc main() {}\n")
			return
		}
		http.NotFound(w, r)
	}))
	defer githubServer.Close()

	job := model.RepositoryJob{
		CandidateID: "candidate-3", Index: 0, URL: "https://github.com/octo/demo",
		Owner: "octo", Name: "demo", Status: model.RepositoryAnalyzed,
		Tree: []model.RepoTreeNode{{Name: "main.go", Type: "file", SHA: "b1", Size: 120}},
	}
	dataStore := &fakeStore{
		job:          job,
		done:         make(chan struct{}),
		findingsDone: make(chan struct{}, 1),
	}
	reviewer := &fakeReviewer{findings: []model.Finding{{
		Severity: "high", Title: "Thiếu xử lý lỗi", Module: "main",
		File: "main.go", Line: 3, State: "open", Code: "func main() {}", HitLine: 1,
	}}}
	worker := New(dataStore)
	worker.SetReviewer(reviewer)
	worker.githubBaseURL = githubServer.URL
	worker.idle = 5 * time.Millisecond
	worker.throttle = time.Millisecond
	worker.reviewTimeout = 5 * time.Second

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		worker.Run(ctx)
		close(runDone)
	}()

	select {
	case <-dataStore.findingsDone:
	case <-time.After(3 * time.Second):
		t.Fatal("worker did not finish the findings analysis in time")
	}
	cancel()
	<-runDone

	dataStore.mu.Lock()
	defer dataStore.mu.Unlock()
	if dataStore.status != "" {
		t.Fatalf("status = %q, a findings-only job must not rescan", dataStore.status)
	}
	if !reviewer.called {
		t.Fatal("reviewer was not called")
	}
	if len(reviewer.files) != 1 || reviewer.files[0] != "main.go" {
		t.Fatalf("review files = %v, want main.go", reviewer.files)
	}
	if dataStore.findingsState != model.RepositoryFindingsAnalyzed {
		t.Fatalf("findings state = %q, want analyzed", dataStore.findingsState)
	}
	if !strings.Contains(dataStore.findingsDetail, "1 phát hiện") {
		t.Fatalf("findings detail = %q, want finding count", dataStore.findingsDetail)
	}
	if dataStore.findingsRepo != job.URL {
		t.Fatalf("findings repo = %q, want %q", dataStore.findingsRepo, job.URL)
	}
	if len(dataStore.findingsSaved) != 1 {
		t.Fatalf("saved findings = %d, want one", len(dataStore.findingsSaved))
	}
}

func TestWorkerMarksFindingsFailedWhenAIRejects(t *testing.T) {
	githubServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "package main\n")
	}))
	defer githubServer.Close()

	job := model.RepositoryJob{
		CandidateID: "candidate-4", Index: 0, URL: "https://github.com/octo/broken",
		Owner: "octo", Name: "broken", Status: model.RepositoryAnalyzed,
		Tree: []model.RepoTreeNode{{Name: "main.go", Type: "file", SHA: "b1", Size: 120}},
	}
	dataStore := &fakeStore{
		job:          job,
		done:         make(chan struct{}),
		findingsDone: make(chan struct{}, 1),
	}
	reviewer := &fakeReviewer{err: fmt.Errorf("Google từ chối API key")}
	worker := New(dataStore)
	worker.SetReviewer(reviewer)
	worker.githubBaseURL = githubServer.URL
	worker.idle = 5 * time.Millisecond
	worker.throttle = time.Millisecond
	worker.reviewTimeout = 5 * time.Second

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		worker.Run(ctx)
		close(runDone)
	}()

	select {
	case <-dataStore.findingsDone:
	case <-time.After(3 * time.Second):
		t.Fatal("worker did not record the findings failure in time")
	}
	cancel()
	<-runDone

	dataStore.mu.Lock()
	defer dataStore.mu.Unlock()
	if dataStore.findingsState != model.RepositoryFindingsFailed {
		t.Fatalf("findings state = %q, want failed", dataStore.findingsState)
	}
	if !strings.Contains(dataStore.findingsDetail, "API key") {
		t.Fatalf("findings detail = %q, want provider message", dataStore.findingsDetail)
	}
}

func TestWorkerFallsBackToAnotherEnabledModel(t *testing.T) {
	githubServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "package main\n")
	}))
	defer githubServer.Close()

	job := model.RepositoryJob{
		CandidateID: "candidate-5", Index: 0, URL: "https://github.com/octo/demo",
		Owner: "octo", Name: "demo", Status: model.RepositoryAnalyzed,
		Tree: []model.RepoTreeNode{{Name: "main.go", Type: "file", SHA: "b1", Size: 120}},
	}
	dataStore := &fakeStore{
		job:          job,
		done:         make(chan struct{}),
		findingsDone: make(chan struct{}, 1),
		models: []model.AIModel{
			{ID: "gemini", Name: "Gemini", Provider: "Google", Active: true},
			{ID: "gpt", Name: "GPT", Provider: "OpenAI", Active: true},
			{ID: "gemini-3.5-flash-lite", Name: "Gemini", Provider: "Google", Active: true},
		},
	}
	reviewer := &fakeReviewer{
		findings: []model.Finding{{
			Severity: "high", Title: "Thiếu xử lý lỗi", Module: "main",
			File: "main.go", Line: 3, State: "open", Code: "func main() {}", HitLine: 1,
		}},
		errs: map[string]error{"gemini": unavailableError{message: "Model gemini không khả dụng"}},
	}
	worker := New(dataStore)
	worker.SetReviewer(reviewer)
	worker.githubBaseURL = githubServer.URL
	worker.idle = 5 * time.Millisecond
	worker.throttle = time.Millisecond
	worker.reviewTimeout = 5 * time.Second

	ctx, cancel := context.WithCancel(context.Background())
	runDone := make(chan struct{})
	go func() {
		worker.Run(ctx)
		close(runDone)
	}()

	select {
	case <-dataStore.findingsDone:
	case <-time.After(3 * time.Second):
		t.Fatal("worker did not finish the findings analysis in time")
	}
	cancel()
	<-runDone

	dataStore.mu.Lock()
	defer dataStore.mu.Unlock()
	if dataStore.findingsState != model.RepositoryFindingsAnalyzed {
		t.Fatalf("findings state = %q, want analyzed", dataStore.findingsState)
	}
	want := []string{"gemini", "gemini-3.5-flash-lite"}
	if strings.Join(reviewer.models, ",") != strings.Join(want, ",") {
		t.Fatalf("reviewed with %v, want %v (no cross-provider fallback)", reviewer.models, want)
	}
	if len(dataStore.findingsSaved) != 1 {
		t.Fatalf("saved findings = %d, want one", len(dataStore.findingsSaved))
	}
}
