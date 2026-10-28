package model

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
)

type Repository struct {
	URL     string `json:"url"`
	Label   string `json:"label"`
	Kind    string `json:"kind"`
	Status  string `json:"status"`
	Context string `json:"context"`
	Detail  string `json:"detail"`
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

type Meta struct {
	Model      string     `json:"model"`
	Pages      *int       `json:"pages"`
	Characters int        `json:"characters"`
	DurationMs int64      `json:"durationMs"`
	Truncated  bool       `json:"truncated"`
	Github     GithubMeta `json:"github"`
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
