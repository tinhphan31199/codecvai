package model

// CompareCV is the normalized snapshot the comparison screen puts side by side.
type CompareCV struct {
	ID         string   `json:"id"`
	Source     string   `json:"source"`
	Name       string   `json:"name"`
	Title      string   `json:"title"`
	Level      string   `json:"level"`
	Years      int      `json:"years"`
	Category   string   `json:"category,omitempty"`
	Summary    string   `json:"summary"`
	Skills     []string `json:"skills"`
	Highlights []string `json:"highlights"`
}

// CVComparison is the AI verdict over the compared CVs.
type CVComparison struct {
	Summary          string   `json:"summary"`
	BestCvID         string   `json:"bestCvId"`
	BestReasons      []string `json:"bestReasons"`
	MyStrengths      []string `json:"myStrengths"`
	MyGaps           []string `json:"myGaps"`
	MarketHighlights []string `json:"marketHighlights"`
}
