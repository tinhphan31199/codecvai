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

	// Trạng thái phân tích phát hiện cuối (AI đọc mã nguồn đã quét).
	RepositoryFindingsPending   = "pending"
	RepositoryFindingsAnalyzing = "analyzing"
	RepositoryFindingsAnalyzed  = "analyzed"
	RepositoryFindingsFailed    = "failed"

	// Vai trò của một lượt trong khung hỏi đáp repository.
	ChatRoleUser      = "user"
	ChatRoleAssistant = "assistant"
)

type Repository struct {
	URL     string `json:"url"`
	Label   string `json:"label"`
	Kind    string `json:"kind"`
	Status  string `json:"status"`
	Context string `json:"context"`
	Detail  string `json:"detail"`
	// Tree, Details and Summary only travel through the scan pipeline to the store.
	Tree    []RepoTreeNode `json:"-"`
	Details *RepoDetails   `json:"-"`
	Summary *RepoSummary   `json:"-"`
}

// RepoTreeNode is one folder or file of the stored repository tree.
type RepoTreeNode struct {
	Name     string         `json:"name"`
	Type     string         `json:"type"`
	SHA      string         `json:"sha,omitempty"`
	Size     int64          `json:"size,omitempty"`
	Children []RepoTreeNode `json:"children,omitempty"`
}

type RepoLanguage struct {
	Name    string  `json:"name"`
	Percent float64 `json:"percent"`
}

type RepoCommit struct {
	SHA     string `json:"sha"`
	Message string `json:"message"`
	Date    string `json:"date"`
}

// RepoDetails holds the repository facts read from GitHub for the Repository screen.
type RepoDetails struct {
	FullName      string         `json:"fullName"`
	Description   string         `json:"description"`
	Language      string         `json:"language"`
	Languages     []RepoLanguage `json:"languages"`
	Topics        []string       `json:"topics"`
	Stars         int            `json:"stars"`
	Forks         int            `json:"forks"`
	Watchers      int            `json:"watchers"`
	OpenIssues    int            `json:"openIssues"`
	SizeKB        int            `json:"sizeKb"`
	DefaultBranch string         `json:"defaultBranch"`
	PushedAt      string         `json:"pushedAt"`
	CreatedAt     string         `json:"createdAt"`
	Homepage      string         `json:"homepage"`
	License       string         `json:"license"`
	Fork          bool           `json:"fork"`
	Archived      bool           `json:"archived"`
	Readme        string         `json:"readme"`
	ReadmeChars   int            `json:"readmeChars"`
	FileCount     int            `json:"fileCount"`
	TreeTruncated bool           `json:"treeTruncated"`
	Commits       []RepoCommit   `json:"commits"`
}

// RepoSummary is the structural synthesis derived from a scanned repository
// tree, stored with the scan so the screen never has to read file contents.
type RepoSummary struct {
	Files       int            `json:"files"`
	Folders     int            `json:"folders"`
	SizeKB      int64          `json:"sizeKb"`
	Tests       int            `json:"tests"`
	Flags       []string       `json:"flags"`
	Modules     []RepoModule   `json:"modules"`
	FileTypes   []RepoFileType `json:"fileTypes"`
	KeyFiles    []RepoKeyFile  `json:"keyFiles"`
	Entrypoints []string       `json:"entrypoints"`
}

// RepoModule is one top-level folder of the repository with its file count.
type RepoModule struct {
	Name  string `json:"name"`
	Files int    `json:"files"`
}

// RepoFileType counts files by extension (or file name when there is none).
type RepoFileType struct {
	Ext   string `json:"ext"`
	Count int    `json:"count"`
}

// RepoKeyFile marks a notable scanned file; Kind is manifest, config, docs,
// ci, container, license or entry.
type RepoKeyFile struct {
	Path string `json:"path"`
	Kind string `json:"kind"`
}

// RepositoryRecord is one repository stored with a CV analysis; pending rows
// are picked up by the background worker after the request has finished.
type RepositoryRecord struct {
	Index          int            `json:"-"`
	URL            string         `json:"url"`
	Label          string         `json:"label"`
	Kind           string         `json:"kind"`
	Status         string         `json:"status"`
	Context        string         `json:"context"`
	Detail         string         `json:"detail"`
	Source         string         `json:"source"`
	UpdatedAt      time.Time      `json:"updatedAt"`
	Owner          string         `json:"-"`
	Name           string         `json:"-"`
	Tree           []RepoTreeNode `json:"-"`
	Details        *RepoDetails   `json:"-"`
	Summary        *RepoSummary   `json:"-"`
	HasTree        bool           `json:"hasTree"`
	FindingsState  string         `json:"findingsState"`
	FindingsDetail string         `json:"findingsDetail"`
}

// RepositoryJob is a claimed repository row, one at a time. Status is the
// repository status before the claim: analyzed means GitHub data is already
// stored and only the final findings analysis is missing.
type RepositoryJob struct {
	CandidateID string
	Index       int
	URL         string
	Owner       string
	Name        string
	Status      string
	Tree        []RepoTreeNode
	Details     *RepoDetails
	Summary     *RepoSummary
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
