// Package repoqueue reads the repositories saved by a CV analysis one at a
// time, after the upload request has already answered. Keeping the worker
// single-threaded and throttled avoids GitHub's secondary rate limits.
package repoqueue

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	"codecv/backend/internal/github"
	"codecv/backend/internal/model"
	"codecv/backend/internal/store"
)

type Store interface {
	ServiceConfig(ctx context.Context, id string) (model.ServiceConfig, error)
	PendingRepositoryJob(ctx context.Context) (model.RepositoryJob, bool, error)
	FinishRepositoryJob(ctx context.Context, job model.RepositoryJob, status, summary, detail string) error
	ResetAnalyzingRepositories(ctx context.Context) error
}

type Worker struct {
	store         Store
	githubBaseURL string
	idle          time.Duration
	throttle      time.Duration
	jobTimeout    time.Duration
	notify        chan struct{}
}

func New(dataStore Store) *Worker {
	return &Worker{
		store:         dataStore,
		githubBaseURL: "https://api.github.com",
		idle:          15 * time.Second,
		throttle:      2 * time.Second,
		jobTimeout:    45 * time.Second,
		notify:        make(chan struct{}, 1),
	}
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
	if err := w.store.FinishRepositoryJob(ctx, job, status, repository.Context, repository.Detail); err != nil {
		log.Printf("[repo-queue] save %s/%s failed: %v", job.Owner, job.Name, err)
		return
	}
	log.Printf(
		"[repo-queue] candidate=%s repo=%s/%s status=%s duration=%s",
		job.CandidateID, job.Owner, job.Name, status,
		time.Since(startedAt).Round(time.Millisecond),
	)
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
