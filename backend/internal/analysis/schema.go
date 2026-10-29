package analysis

import (
	"sort"
	"strings"

	"codecv/backend/internal/model"
)

var geminiSchema = map[string]any{
	"type": "OBJECT",
	"properties": map[string]any{
		"candidate": map[string]any{
			"type": "OBJECT",
			"properties": map[string]any{
				"name":            map[string]any{"type": "STRING"},
				"email":           map[string]any{"type": "STRING"},
				"phone":           map[string]any{"type": "STRING"},
				"location":        map[string]any{"type": "STRING"},
				"currentTitle":    map[string]any{"type": "STRING"},
				"yearsExperience": map[string]any{"type": "NUMBER"},
			},
			"required": []string{"name"},
		},
		"summary": map[string]any{"type": "STRING"},
		"criteria": map[string]any{
			"type": "ARRAY",
			"items": map[string]any{
				"type": "OBJECT",
				"properties": map[string]any{
					"status": map[string]any{
						"type": "STRING",
						"enum": []string{
							model.EvidenceVerified,
							model.EvidenceInferred,
							model.EvidenceMissing,
						},
					},
					"quote": map[string]any{"type": "STRING"},
					"note":  map[string]any{"type": "STRING"},
				},
				"required": []string{"status", "quote", "note"},
			},
		},
		"strengths": map[string]any{
			"type":  "ARRAY",
			"items": map[string]any{"type": "STRING"},
		},
		"gaps": map[string]any{
			"type":  "ARRAY",
			"items": map[string]any{"type": "STRING"},
		},
		"questions": map[string]any{
			"type": "ARRAY",
			"items": map[string]any{
				"type": "OBJECT",
				"properties": map[string]any{
					"question":  map[string]any{"type": "STRING"},
					"topic":     map[string]any{"type": "STRING"},
					"rationale": map[string]any{"type": "STRING"},
				},
				"required": []string{"question", "topic", "rationale"},
			},
		},
	},
	"required": []string{"candidate", "summary", "criteria", "strengths", "gaps", "questions"},
}

// GeminiSchema dùng đúng chữ hoa kiểu OpenAPI mà generateContent yêu cầu.
func GeminiSchema() map[string]any {
	return geminiSchema
}

// JSONSchema là bản chuẩn JSON Schema (chữ thường) cho OpenAI và Anthropic.
func JSONSchema() map[string]any {
	schema, _ := convertSchema(geminiSchema, false).(map[string]any)
	return schema
}

// StrictSchema thêm additionalProperties=false và required đầy đủ để dùng với
// chế độ structured outputs strict của OpenAI.
func StrictSchema() map[string]any {
	schema, _ := convertSchema(geminiSchema, true).(map[string]any)
	return schema
}

func convertSchema(node any, strict bool) any {
	switch value := node.(type) {
	case map[string]any:
		converted := make(map[string]any, len(value)+1)
		for key, item := range value {
			if key == "type" {
				if text, ok := item.(string); ok {
					converted[key] = strings.ToLower(text)
					continue
				}
			}
			converted[key] = convertSchema(item, strict)
		}
		if strict && converted["type"] == "object" {
			converted["additionalProperties"] = false
			if properties, ok := converted["properties"].(map[string]any); ok {
				keys := make([]string, 0, len(properties))
				for key := range properties {
					keys = append(keys, key)
				}
				sort.Strings(keys)
				converted["required"] = keys
			}
		}
		return converted
	case []any:
		converted := make([]any, len(value))
		for index, item := range value {
			converted[index] = convertSchema(item, strict)
		}
		return converted
	default:
		return value
	}
}
