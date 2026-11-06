package model

// GeneratedCVContent is the structured AI output shared by every CV template.
type GeneratedCVContent struct {
	Summary        string                   `json:"summary"`
	Experience     []GeneratedExperience    `json:"experience"`
	Education      []GeneratedEducation     `json:"education"`
	Projects       []GeneratedProject       `json:"projects"`
	Skills         []GeneratedSkillGroup    `json:"skills"`
	Certifications []GeneratedCertification `json:"certifications"`
	Languages      []GeneratedLanguage      `json:"languages"`
}

type GeneratedExperience struct {
	Company  string   `json:"company"`
	Role     string   `json:"role"`
	Period   string   `json:"period"`
	Location string   `json:"location,omitempty"`
	Bullets  []string `json:"bullets"`
}

type GeneratedEducation struct {
	School string `json:"school"`
	Degree string `json:"degree,omitempty"`
	Period string `json:"period,omitempty"`
	Detail string `json:"detail,omitempty"`
}

type GeneratedProject struct {
	Name    string   `json:"name"`
	Role    string   `json:"role,omitempty"`
	Period  string   `json:"period,omitempty"`
	Link    string   `json:"link,omitempty"`
	Bullets []string `json:"bullets"`
}

type GeneratedSkillGroup struct {
	Group string   `json:"group"`
	Items []string `json:"items"`
}

type GeneratedCertification struct {
	Name   string `json:"name"`
	Issuer string `json:"issuer,omitempty"`
	Year   string `json:"year,omitempty"`
}

type GeneratedLanguage struct {
	Name  string `json:"name"`
	Level string `json:"level,omitempty"`
}

// BuilderInput is the form snapshot kept beside the generated content so the
// editor can reopen the exact answers and regenerate without retyping.
type BuilderInput struct {
	FullName       string              `json:"fullName"`
	Email          string              `json:"email"`
	Phone          string              `json:"phone"`
	Location       string              `json:"location"`
	LinkedIn       string              `json:"linkedin"`
	GitHub         string              `json:"github"`
	Portfolio      string              `json:"portfolio"`
	Position       string              `json:"position"`
	Level          string              `json:"level"`
	Years          int                 `json:"years"`
	Skills         []string            `json:"skills"`
	Experiences    []BuilderExperience `json:"experiences"`
	Education      []BuilderEducation  `json:"education"`
	Projects       []BuilderProject    `json:"projects"`
	Certifications []string            `json:"certifications"`
	Languages      []string            `json:"languages"`
	Notes          string              `json:"notes"`
	Avatar         string              `json:"avatar,omitempty"`
	SourceID       string              `json:"sourceCandidateId,omitempty"`
}

type BuilderExperience struct {
	Company     string `json:"company"`
	Role        string `json:"role"`
	Period      string `json:"period"`
	Description string `json:"description"`
}

type BuilderEducation struct {
	School string `json:"school"`
	Degree string `json:"degree"`
	Period string `json:"period"`
}

type BuilderProject struct {
	Name        string `json:"name"`
	Role        string `json:"role"`
	Period      string `json:"period"`
	Description string `json:"description"`
}

// BuilderDraft is the per-account snapshot of the builder form, kept before
// the user generates or saves a CV.
type BuilderDraft struct {
	Input     BuilderInput `json:"input"`
	Language  string       `json:"language"`
	Template  string       `json:"template"`
	Accent    string       `json:"accent"`
	UpdatedAt string       `json:"updatedAt"`
}

// GeneratedCVDraft is one AI generation result before the user saves it.
type GeneratedCVDraft struct {
	Content  GeneratedCVContent `json:"content"`
	Template string             `json:"template"`
	Accent   string             `json:"accent"`
}

// GeneratedCV is one saved private CV owned by a single account.
type GeneratedCV struct {
	ID             string             `json:"id"`
	Name           string             `json:"name"`
	TargetPosition string             `json:"targetPosition"`
	Level          string             `json:"level"`
	Language       string             `json:"language"`
	Template       string             `json:"template"`
	Accent         string             `json:"accent"`
	Content        GeneratedCVContent `json:"content"`
	Input          BuilderInput       `json:"input"`
	ModelID        string             `json:"modelId,omitempty"`
	Provider       string             `json:"provider,omitempty"`
	CreatedAt      string             `json:"createdAt"`
	UpdatedAt      string             `json:"updatedAt"`
}

// GeneratedCVSummary is the lightweight row used by the saved-CV list.
type GeneratedCVSummary struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	TargetPosition string `json:"targetPosition"`
	Level          string `json:"level"`
	Language       string `json:"language"`
	Template       string `json:"template"`
	Accent         string `json:"accent"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
}
