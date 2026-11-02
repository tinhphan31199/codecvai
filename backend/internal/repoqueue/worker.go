// Package repoqueue reads the repositories saved by a CV analysis one at a
// time, after the upload request has already answered. Keeping the worker
// single-threaded and throttled avoids GitHub's secondary rate limits.
package repoqueue

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"codecv/backend/internal/github"
	"codecv/backend/internal/model"
	"codecv/backend/internal/reporeview"
	"codecv/backend/internal/store"
)

type Store interface {
	ServiceConfig(ctx context.Context, id string) (model.ServiceConfig, error)
	PendingRepositoryJob(ctx context.Context) (model.RepositoryJob, bool, error)
	FinishRepositoryJob(
		ctx context.Context,
		job model.RepositoryJob,
		status, contextText, detail string,
		tree []model.RepoTreeNode,
		details *model.RepoDetails,
		summary *model.RepoSummary,
	) error
	ResetAnalyzingRepositories(ctx context.Context) error
	BackfillRepositorySummaries(ctx context.Context) (int, error)
	PrimaryRepositoryURL(ctx context.Context, candidateID string) (string, error)
	StartRepositoryFindings(ctx context.Context, candidateID string, index int) (bool, error)
	SetRepositoryFindingsState(ctx context.Context, candidateID string, index int, state, detail string) error
	SaveRepositoryFindings(ctx context.Context, candidateID, repoURL string, findings []model.Finding) error
	ActiveModels(ctx context.Context) ([]model.AIModel, error)
}

// Reviewer runs the final AI read of a scanned repository.
type Reviewer interface {
	ReviewRepository(ctx context.Context, modelID string, in reporeview.Input) ([]model.Finding, error)
}

type Worker struct {
	store         Store
	reviewer      Reviewer
	githubBaseURL string
	idle          time.Duration
	throttle      time.Duration
	jobTimeout    time.Duration
	reviewTimeout time.Duration
	notify        chan struct{}
}

func New(dataStore Store) *Worker {
	return &Worker{
		store:         dataStore,
		githubBaseURL: "https://api.github.com",
		idle:          15 * time.Second,
		throttle:      2 * time.Second,
		jobTimeout:    45 * time.Second,
		reviewTimeout: 2 * time.Minute,
		notify:        make(chan struct{}, 1),
	}
}

// SetReviewer wires the AI gateway used for the final findings analysis.
func (w *Worker) SetReviewer(reviewer Reviewer) {
	w.reviewer = reviewer
}

// Notify wakes the worker after a CV analysis saved pending repositories.
func (w *Worker) Notify() {
	select {
	case w.notify <- struct{}{}:
	default:
	}
}

func (w *Worker) Run(ctx context.Context) {
	if err := w.store.ResetAnalyzingRepositories(ctx); err != nil {
		log.Printf("[repo-queue] reset analyzing failed: %v", err)
	}
	if count, err := w.store.BackfillRepositorySummaries(ctx); err != nil {
		log.Printf("[repo-queue] backfill summaries failed: %v", err)
	} else if count > 0 {
		log.Printf("[repo-queue] backfilled %d repository summaries", count)
	}
	log.Printf("[repo-queue] ready: one repository at a time, %s between repos", w.throttle)

	for {
		if ctx.Err() != nil {
			return
		}

		job, ok, err := w.store.PendingRepositoryJob(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("[repo-queue] claim failed: %v", err)
			if !w.sleep(ctx, w.idle) {
				return
			}
			continue
		}
		if !ok {
			if !w.idleWait(ctx) {
				return
			}
			continue
		}

		w.process(ctx, job)
		if !w.sleep(ctx, w.throttle) {
			return
		}
	}
}

func (w *Worker) process(ctx context.Context, job model.RepositoryJob) {
	// Status analyzed means the GitHub data is already stored and only the
	// final findings analysis was queued.
	if job.Status == model.RepositoryAnalyzed {
		w.reviewFindings(ctx, job, job.Tree, job.Details, job.Summary)
		return
	}

	startedAt := time.Now()
	baseURL, token := w.githubConfig(ctx)

	jobCtx, cancel := context.WithTimeout(ctx, w.jobTimeout)
	defer cancel()
	repository := github.New(baseURL, token).Repo(jobCtx, job.Owner, job.Name)

	status := repository.Status
	if status != model.RepositoryAnalyzed {
		status = model.RepositoryUnavailable
	}
	if ctx.Err() != nil {
		return
	}
	if err := w.store.FinishRepositoryJob(
		ctx, job, status, repository.Context, repository.Detail,
		repository.Tree, repository.Details, repository.Summary,
	); err != nil {
		log.Printf("[repo-queue] save %s/%s failed: %v", job.Owner, job.Name, err)
		return
	}
	log.Printf(
		"[repo-queue] candidate=%s repo=%s/%s status=%s duration=%s",
		job.CandidateID, job.Owner, job.Name, status,
		time.Since(startedAt).Round(time.Millisecond),
	)

	if status != model.RepositoryAnalyzed {
		return
	}
	// Only the repository the Repository screen opens by default is reviewed
	// automatically; other repos wait for the explicit "phân tích" action.
	primary, err := w.store.PrimaryRepositoryURL(ctx, job.CandidateID)
	if err != nil {
		log.Printf("[repo-queue] primary repo lookup failed: %v", err)
		return
	}
	if primary == "" || !strings.EqualFold(primary, job.URL) {
		return
	}
	started, err := w.store.StartRepositoryFindings(ctx, job.CandidateID, job.Index)
	if err != nil {
		log.Printf("[repo-queue] start findings failed: %v", err)
		return
	}
	if !started {
		return
	}
	w.reviewFindings(ctx, job, repository.Tree, repository.Details, repository.Summary)
}

// reviewFindings reads the sampled blobs and stores the AI findings for one
// repository, recording a visible state on every failure.
func (w *Worker) reviewFindings(ctx context.Context, job model.RepositoryJob, tree []model.RepoTreeNode, details *model.RepoDetails, summary *model.RepoSummary) {
	fail := func(detail string) {
		if ctx.Err() != nil {
			return
		}
		if err := w.store.SetRepositoryFindingsState(ctx, job.CandidateID, job.Index, model.RepositoryFindingsFailed, detail); err != nil {
			log.Printf("[repo-queue] findings state failed: %v", err)
		}
		log.Printf("[repo-queue] findings candidate=%s repo=%s failed: %s", job.CandidateID, job.URL, detail)
	}

	if len(tree) == 0 {
		fail("Repository chưa có cây tệp. Chạy lại phân tích repository rồi thử lại.")
		return
	}
	if w.reviewer == nil {
		fail("Máy chủ chưa cấu hình AI để phân tích phát hiện.")
		return
	}
	aiModels, err := w.store.ActiveModels(ctx)
	if err != nil {
		log.Printf("[repo-queue] active models lookup failed: %v", err)
		fail("Không đọc được model AI. Thử lại sau.")
		return
	}
	if len(aiModels) == 0 {
		fail("Chưa có model AI nào được bật. Bật model ở Cài đặt → AI models.")
		return
	}

	paths := reporeview.Plan(tree, summary, reporeview.MaxFiles)
	if len(paths) == 0 {
		if err := w.store.SaveRepositoryFindings(ctx, job.CandidateID, job.URL, nil); err != nil {
			log.Printf("[repo-queue] save empty findings failed: %v", err)
			fail("Không lưu được kết quả phân tích. Thử lại sau.")
			return
		}
		w.finishFindings(ctx, job, "Không có tệp mã nguồn phù hợp để phân tích.")
		return
	}

	baseURL, token := w.githubConfig(ctx)
	client := github.New(baseURL, token)
	reviewCtx, cancel := context.WithTimeout(ctx, w.reviewTimeout)
	defer cancel()

	files := make([]reporeview.File, 0, len(paths))
	for _, filePath := range paths {
		sha := reporeview.BlobSHA(tree, filePath)
		if sha == "" {
			continue
		}
		content, _, err := client.File(reviewCtx, job.Owner, job.Name, sha)
		if err != nil {
			log.Printf("[repo-queue] read %s/%s/%s failed: %v", job.Owner, job.Name, filePath, err)
			continue
		}
		if strings.TrimSpace(content) == "" {
			continue
		}
		files = append(files, reporeview.File{Path: filePath, Content: content})
	}
	if len(files) == 0 {
		fail("Không đọc được tệp nào từ GitHub. Thử lại sau ít phút.")
		return
	}

	startedAt := time.Now()
	input := reporeview.Input{
		RepositoryURL: job.URL,
		Description:   repoDescription(details),
		Languages:     repoLanguages(details),
		Readme:        repoReadme(details),
		Summary:       summary,
		Files:         files,
	}
	// The first enabled model is the configured default. When a provider no
	// longer serves that model code, another enabled model of the same
	// provider is tried instead of failing the whole analysis.
	var (
		findings  []model.Finding
		aiModel   model.AIModel
		reviewErr error
	)
	provider := strings.TrimSpace(aiModels[0].Provider)
	for index, candidate := range aiModels {
		if index > 0 && !strings.EqualFold(strings.TrimSpace(candidate.Provider), provider) {
			continue
		}
		findings, reviewErr = w.reviewer.ReviewRepository(reviewCtx, candidate.ID, input)
		if reviewErr == nil {
			aiModel = candidate
			break
		}
		if ctx.Err() != nil {
			return
		}
		if !modelUnavailable(reviewErr) {
			break
		}
		log.Printf("[repo-queue] model %s unavailable, trying another %s model", candidate.ID, provider)
	}
	if aiModel.ID == "" {
		log.Printf("[repo-queue] findings ai failed candidate=%s repo=%s: %v", job.CandidateID, job.URL, reviewErr)
		fail(reviewErr.Error())
		return
	}
	if ctx.Err() != nil {
		return
	}
	if err := w.store.SaveRepositoryFindings(ctx, job.CandidateID, job.URL, findings); err != nil {
		log.Printf("[repo-queue] save findings failed: %v", err)
		fail("Không lưu được kết quả phân tích. Thử lại sau.")
		return
	}

	detail := fmt.Sprintf("Đã đọc %d tệp · %d phát hiện", len(files), len(findings))
	if len(findings) == 0 {
		detail = fmt.Sprintf("Đã đọc %d tệp · không thấy vấn đề đáng chú ý", len(files))
	}
	w.finishFindings(ctx, job, detail)
	log.Printf(
		"[repo-queue] findings candidate=%s repo=%s model=%s files=%d findings=%d duration=%s",
		job.CandidateID, job.URL, aiModel.ID, len(files), len(findings),
		time.Since(startedAt).Round(time.Millisecond),
	)
}

// modelUnavailable reports whether the provider rejected the model code itself.
func modelUnavailable(err error) bool {
	var target interface{ ModelUnavailable() bool }
	return errors.As(err, &target) && target.ModelUnavailable()
}

func (w *Worker) finishFindings(ctx context.Context, job model.RepositoryJob, detail string) {
	if err := w.store.SetRepositoryFindingsState(ctx, job.CandidateID, job.Index, model.RepositoryFindingsAnalyzed, detail); err != nil {
		log.Printf("[repo-queue] findings state analyzed failed: %v", err)
	}
}

func repoDescription(details *model.RepoDetails) string {
	if details == nil {
		return ""
	}
	return details.Description
}

func repoLanguages(details *model.RepoDetails) string {
	if details == nil {
		return ""
	}
	if len(details.Languages) > 0 {
		parts := make([]string, 0, len(details.Languages))
		for _, language := range details.Languages {
			parts = append(parts, fmt.Sprintf("%s %.0f%%", language.Name, language.Percent))
		}
		return strings.Join(parts, ", ")
	}
	return details.Language
}

func repoReadme(details *model.RepoDetails) string {
	if details == nil {
		return ""
	}
	return details.Readme
}

func (w *Worker) githubConfig(ctx context.Context) (string, string) {
	baseURL := w.githubBaseURL
	token := ""
	cfg, err := w.store.ServiceConfig(ctx, "github")
	switch {
	case err == nil:
		if trimmed := strings.TrimSpace(cfg.BaseURL); trimmed != "" {
			baseURL = trimmed
		}
		token = strings.TrimSpace(cfg.APIKey)
	case !errors.Is(err, store.ErrNotFound):
		log.Printf("[repo-queue] github config lookup failed: %v", err)
	}
	return baseURL, token
}

func (w *Worker) idleWait(ctx context.Context) bool {
	timer := time.NewTimer(w.idle)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-w.notify:
		return true
	case <-timer.C:
		return true
	}
}

func (w *Worker) sleep(ctx context.Context, duration time.Duration) bool {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
