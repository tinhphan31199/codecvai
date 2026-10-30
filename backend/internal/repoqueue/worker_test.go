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
	"codecv/backend/internal/store"
)

type fakeStore struct {
	job model.RepositoryJob

	mu       sync.Mutex
	claimed  bool
	reset    bool
	finished bool
	status   string
	summary  string
	detail   string
	done     chan struct{}
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

func (f *fakeStore) FinishRepositoryJob(_ context.Context, _ model.RepositoryJob, status, summary, detail string) error {
	f.mu.Lock()
	f.finished = true
	f.status = status
	f.summary = summary
	f.detail = detail
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
	if !dataStore.finished {
		t.Fatal("worker did not persist the result")
	}
	if dataStore.status != model.RepositoryAnalyzed {
		t.Fatalf("status = %q, want %q", dataStore.status, model.RepositoryAnalyzed)
	}
	if !strings.Contains(dataStore.summary, "Go") || !strings.Contains(dataStore.summary, "3★") {
		t.Fatalf("summary = %q, want language and stars", dataStore.summary)
	}
	if !strings.Contains(dataStore.detail, "Đã đọc repo") {
		t.Fatalf("detail = %q, want read confirmation", dataStore.detail)
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
