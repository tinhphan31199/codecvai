package model

import "time"

const (
	CriterionMust = "must"
	CriterionNice = "nice"

	EvidenceVerified = "verified"
	EvidenceInferred = "inferred"
	EvidenceMissing  = "missing"

	RepositoryRepo    = "repo"
	RepositoryProfile = "profile"
	RepositoryLink    = "link"

	RepositoryAnalyzed    = "analyzed"
	RepositoryUnavailable = "unavailable"
	RepositorySkipped     = "skipped"
	RepositoryPending     = "pending"
	RepositoryAnalyzing   = "analyzing"
)

type Repository struct {
	URL     string `json:"url"`
	Label   string `json:"label"`
	Kind    string `json:"kind"`
	Status  string `json:"status"`
	Context string `json:"context"`
	Detail  string `json:"detail"`
}

// RepositoryRecord is one repository stored with a CV analysis; pending rows
// are picked up by the background worker after the request has finished.
type RepositoryRecord struct {
	URL       string    `json:"url"`
	Label     string    `json:"label"`
	Kind      string    `json:"kind"`
	Status    string    `json:"status"`
	Context   string    `json:"context"`
	Detail    string    `json:"detail"`
	Source    string    `json:"source"`
	UpdatedAt time.Time `json:"updatedAt"`
	Owner     string    `json:"-"`
	Name      string    `json:"-"`
}

// RepositoryJob is a claimed pending repository, one at a time.
type RepositoryJob struct {
	CandidateID string
	Index       int
	URL         string
	Owner       string
	Name        string
}

type Candidate struct {
	Name            string `json:"name"`
	Email           string `json:"email"`
	Phone           string `json:"phone"`
	Location        string `json:"location"`
	CurrentTitle    string `json:"currentTitle"`
	YearsExperience int    `json:"yearsExperience"`
}

type CriterionEvaluation struct {
	Label  string `json:"label"`
	Kind   string `json:"kind"`
	Status string `json:"status"`
	Quote  string `json:"quote"`
	Note   string `json:"note"`
}

type InterviewQuestion struct {
	Question  string `json:"question"`
	Topic     string `json:"topic"`
	Rationale string `json:"rationale"`
}

type Analysis struct {
	Candidate    Candidate             `json:"candidate"`
	Summary      string                `json:"summary"`
	Repositories []Repository          `json:"repositories"`
	Criteria     []CriterionEvaluation `json:"criteria"`
	Strengths    []string              `json:"strengths"`
	Gaps         []string              `json:"gaps"`
	Questions    []InterviewQuestion   `json:"questions"`
}

type GithubMeta struct {
	Targets     int `json:"targets"`
	Analyzed    int `json:"analyzed"`
	PublicRepos int `json:"publicRepos"`
}

// AnalysisQueueItem is one completed CV analysis shown in the upload queue.
type AnalysisQueueItem struct {
	ID         string    `json:"id"`
	File       string    `json:"file"`
	Candidate  string    `json:"candidate"`
	Position   string    `json:"position"`
	Level      string    `json:"level"`
	Status     string    `json:"status"`
	Criteria   int       `json:"criteria"`
	AnalyzedAt time.Time `json:"analyzedAt"`
}

type Meta struct {
	Model           string     `json:"model"`
	Pages           *int       `json:"pages"`
	Characters      int        `json:"characters"`
	DurationMs      int64      `json:"durationMs"`
	Truncated       bool       `json:"truncated"`
	Github          GithubMeta `json:"github"`
	RepositoryQueue int        `json:"repositoryQueue"`
}

type Response struct {
	Analysis Analysis `json:"analysis"`
	Meta     Meta     `json:"meta"`
}

type ErrorBody struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
