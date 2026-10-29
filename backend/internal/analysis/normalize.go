package analysis

import (
	"encoding/json"
	"math"
	"strings"

	"codecv/backend/internal/model"
	"codecv/backend/internal/positions"
)

// Decode bóc JSON (chịu được code fence) rồi chuẩn hoá về model.Analysis.
func Decode(text string, input Input) (model.Analysis, error) {
	var parsed any
	if err := json.Unmarshal([]byte(StripCodeFence(text)), &parsed); err != nil {
		return model.Analysis{}, err
	}
	return Normalize(parsed, input), nil
}

func Normalize(raw any, input Input) model.Analysis {
	record := asRecord(raw)

	repositories := make([]model.Repository, len(input.Repositories))
	copy(repositories, input.Repositories)

	return model.Analysis{
		Candidate:    normalizeCandidate(record["candidate"]),
		Summary:      asString(record["summary"], 1200),
		Repositories: repositories,
		Criteria:     normalizeCriteria(record["criteria"], input.Position),
		Strengths:    asStringList(record["strengths"], 6, 240),
		Gaps:         asStringList(record["gaps"], 5, 240),
		Questions:    normalizeQuestions(record["questions"], input.IncludeQuestions),
	}
}

func normalizeCandidate(raw any) model.Candidate {
	record := asRecord(raw)

	name := asString(record["name"], 120)
	if name == "" {
		name = "Chưa nhận diện tên"
	}

	years := int(math.Round(asNumber(record["yearsExperience"])))
	if years < 0 || years > 60 {
		if years > 60 {
			years = 60
		} else {
			years = 0
		}
	}

	return model.Candidate{
		Name:            name,
		Email:           asString(record["email"], 160),
		Phone:           asString(record["phone"], 40),
		Location:        asString(record["location"], 120),
		CurrentTitle:    asString(record["currentTitle"], 160),
		YearsExperience: years,
	}
}

func normalizeCriteria(raw any, position positions.Position) []model.CriterionEvaluation {
	list := asSlice(raw)
	criteria := make([]model.CriterionEvaluation, 0, len(position.Criteria))

	for index, criterion := range position.Criteria {
		var item any
		if index < len(list) {
			item = list[index]
		}
		record := asRecord(item)
		status := asStatus(record["status"])
		quote := ""
		if status != model.EvidenceMissing {
			quote = asString(record["quote"], 240)
		}
		criteria = append(criteria, model.CriterionEvaluation{
			Label:  criterion.Label,
			Kind:   criterion.Kind,
			Status: status,
			Quote:  quote,
			Note:   asString(record["note"], 200),
		})
	}

	return criteria
}

func normalizeQuestions(raw any, includeQuestions bool) []model.InterviewQuestion {
	questions := make([]model.InterviewQuestion, 0, 8)
	if !includeQuestions {
		return questions
	}

	for _, item := range asSlice(raw) {
		record := asRecord(item)
		question := asString(record["question"], 400)
		if question == "" {
			continue
		}
		topic := asString(record["topic"], 60)
		if topic == "" {
			topic = "Kỹ thuật"
		}
		questions = append(questions, model.InterviewQuestion{
			Question:  question,
			Topic:     topic,
			Rationale: asString(record["rationale"], 280),
		})
		if len(questions) == 8 {
			break
		}
	}

	return questions
}

func asRecord(value any) map[string]any {
	record, ok := value.(map[string]any)
	if !ok {
		return map[string]any{}
	}
	return record
}

func asSlice(value any) []any {
	list, ok := value.([]any)
	if !ok {
		return nil
	}
	return list
}

func asString(value any, maxLength int) string {
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return clip(strings.TrimSpace(text), maxLength)
}

func asStringList(value any, maxItems, maxLength int) []string {
	list := asSlice(value)
	result := make([]string, 0, min(maxItems, len(list)))
	for _, item := range list {
		text := asString(item, maxLength)
		if text == "" {
			continue
		}
		result = append(result, text)
		if len(result) == maxItems {
			break
		}
	}
	return result
}

func asNumber(value any) float64 {
	number, ok := value.(float64)
	if !ok {
		return 0
	}
	return number
}

func asStatus(value any) string {
	status, _ := value.(string)
	switch status {
	case model.EvidenceVerified, model.EvidenceInferred:
		return status
	default:
		return model.EvidenceMissing
	}
}

func StripCodeFence(text string) string {
	trimmed := strings.TrimSpace(text)
	if strings.HasPrefix(trimmed, "```") {
		trimmed = strings.TrimSpace(trimmed[3:])
		if strings.HasPrefix(strings.ToLower(trimmed), "json") {
			trimmed = strings.TrimSpace(trimmed[4:])
		}
	}
	return strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(trimmed), "```"))
}

func clip(value string, maxLength int) string {
	runes := []rune(value)
	if len(runes) <= maxLength {
		return value
	}
	return string(runes[:maxLength])
}
