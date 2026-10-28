package model

import "encoding/json"

// Criterion matches the frontend `Criterion` shape.
type Criterion struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	Kind     string   `json:"kind"`
	State    string   `json:"state"`
	Evidence int      `json:"evidence"`
	Note     string   `json:"note"`
	Sources  []string `json:"sources"`
}

type Skill struct {
	Name       string `json:"name"`
	Level      string `json:"level"`
	Confidence string `json:"confidence"`
	State      string `json:"state"`
	Source     string `json:"source"`
	Evidence   int    `json:"evidence"`
}

type Finding struct {
	ID           string `json:"id"`
	Severity     string `json:"severity"`
	Title        string `json:"title"`
	Module       string `json:"module"`
	File         string `json:"file"`
	Line         int    `json:"line"`
	State        string `json:"state"`
	Rationale    string `json:"rationale"`
	Verification string `json:"verification"`
	Code         string `json:"code"`
	HitLine      int    `json:"hitLine"`
}

type Question struct {
	ID         string   `json:"id"`
	Category   string   `json:"category"`
	Difficulty string   `json:"difficulty"`
	Text       string   `json:"text"`
	Answer     string   `json:"answer"`
	FollowUps  []string `json:"followUps"`
}

type CandidateRecord struct {
	ID         string      `json:"id"`
	Name       string      `json:"name"`
	Initials   string      `json:"initials"`
	Hue        int         `json:"hue"`
	Role       string      `json:"role"`
	Position   string      `json:"position"`
	Level      string      `json:"level"`
	Status     string      `json:"status"`
	Updated    string      `json:"updated"`
	UpdatedAt  string      `json:"updatedAt"`
	Email      string      `json:"email"`
	Phone      string      `json:"phone"`
	Location   string      `json:"location"`
	Years      int         `json:"years"`
	CreatedAt  string      `json:"createdAt"`
	Source     string      `json:"source"`
	Reviewer   string      `json:"reviewer,omitempty"`
	Summary    string      `json:"summary"`
	Strengths  []string    `json:"strengths"`
	Verify     []string    `json:"verify"`
	Criteria   []Criterion `json:"criteria"`
	Skills     []Skill     `json:"skills,omitempty"`
	Repo       string      `json:"repo,omitempty"`
	RepoBranch string      `json:"repoBranch,omitempty"`
	Commit     string      `json:"commit,omitempty"`
	RepoState  string      `json:"repoState,omitempty"`
	Findings   []Finding   `json:"findings,omitempty"`
	Questions  []Question  `json:"questions,omitempty"`
	Notes      string      `json:"notes,omitempty"`
	StageIndex int         `json:"stageIndex,omitempty"`
}

type PositionCriterion struct {
	Label  string `json:"label"`
	Kind   string `json:"kind"`
	Weight int    `json:"weight"`
	Verify string `json:"verify"`
}

type Position struct {
	ID          string              `json:"id"`
	Title       string              `json:"title"`
	Team        string              `json:"team"`
	Level       string              `json:"level"`
	Open        string              `json:"open"`
	Candidates  int                 `json:"candidates"`
	Updated     string              `json:"updated"`
	Owner       string              `json:"owner"`
	Location    string              `json:"location"`
	Description string              `json:"description"`
	Criteria    []PositionCriterion `json:"criteria"`
}

type Report struct {
	ID          string `json:"id"`
	CandidateID string `json:"candidateId"`
	Candidate   string `json:"candidate"`
	Position    string `json:"position"`
	Version     int    `json:"version"`
	Status      string `json:"status"`
	Reviewer    string `json:"reviewer"`
	Created     string `json:"created"`
}

type TeamMember struct {
	Name     string `json:"name"`
	Initials string `json:"initials"`
	Role     string `json:"role"`
	Email    string `json:"email"`
	Hue      int    `json:"hue"`
}

type AIModel struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
	Note     string `json:"note"`
	Active   bool   `json:"active"`
}

type UploadStage struct {
	ID     int    `json:"id"`
	Label  string `json:"label"`
	Detail string `json:"detail"`
}

type Level struct {
	Name string `json:"name"`
	Rank int    `json:"rank"`
}

type Workspace struct {
	Name          string `json:"name"`
	Total         int    `json:"total"`
	Completed     int    `json:"completed"`
	Review        int    `json:"review"`
	Processing    int    `json:"processing"`
	Failed        int    `json:"failed"`
	Archived      int    `json:"archived"`
	Positions     int    `json:"positions"`
	Updated       string `json:"updated"`
	UpdatedAt     string `json:"updatedAt"`
	Reviewer      string `json:"reviewer"`
	AnalysisModel string `json:"analysisModel"`
}

// RepoAnalysis bundles everything the Repository Analysis screen renders.
type RepoAnalysis struct {
	CandidateID string          `json:"candidateId"`
	Repo        string          `json:"repo"`
	RepoBranch  string          `json:"repoBranch"`
	Commit      string          `json:"commit"`
	RepoState   string          `json:"repoState"`
	Tree        json.RawMessage `json:"tree"`
	Layers      json.RawMessage `json:"layers"`
	Findings    []Finding       `json:"findings"`
}

// Dashboard is the aggregate payload for the overview screen.
type Dashboard struct {
	Workspace  Workspace         `json:"workspace"`
	Review     []CandidateRecord `json:"review"`
	Processing []CandidateRecord `json:"processing"`
	Recent     []CandidateRecord `json:"recent"`
	Positions  []Position        `json:"positions"`
}
