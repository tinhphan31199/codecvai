package api

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"codecv/backend/internal/analysis"
	"codecv/backend/internal/gateway"
	"codecv/backend/internal/model"
)

// handleGenerateCV viết CV từ form người dùng nhập. Endpoint chỉ sinh nội dung;
// CV được lưu riêng khi người dùng bấm lưu ở màn hình CV của tôi.
func (s *Server) handleGenerateCV(w http.ResponseWriter, r *http.Request) {
	startedAt := time.Now()

	var body struct {
		ModelID  string             `json:"modelId"`
		Language string             `json:"language"`
		Template string             `json:"template"`
		Accent   string             `json:"accent"`
		Feedback string             `json:"feedback"`
		Input    model.BuilderInput `json:"input"`
	}
	if err := decodeJSON(r, &body); err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}

	input, message := normalizeBuilderInput(body.Input)
	if message != "" {
		s.fail(w, http.StatusBadRequest, "bad_request", message)
		return
	}

	template := strings.ToLower(strings.TrimSpace(body.Template))
	if template != "" && !analysis.GeneratedTemplateValid(template) {
		s.fail(w, http.StatusBadRequest, "bad_request", "Template không hợp lệ. Chọn lại mẫu CV.")
		return
	}
	accent := strings.ToLower(strings.TrimSpace(body.Accent))
	if accent != "" && !analysis.GeneratedAccentValid(accent) {
		s.fail(w, http.StatusBadRequest, "bad_request", "Màu nhấn không hợp lệ. Chọn lại màu.")
		return
	}

	language := "vi"
	if value := strings.ToLower(strings.TrimSpace(body.Language)); value == "en" || value == "english" {
		language = "en"
	}

	modelID := strings.TrimSpace(body.ModelID)
	if modelID == "" {
		modelID = s.defaultAnalysisModel(r.Context())
	}
	if modelID == "" {
		s.fail(w, http.StatusBadRequest, "bad_request", "Chưa có model AI đang bật. Bật model trong Cài đặt → AI models.")
		return
	}

	result, err := s.gateway.Generate(r.Context(), gateway.GenerateRequest{
		ModelID:  modelID,
		Builder:  input,
		Language: language,
		Template: template,
		Accent:   accent,
		Feedback: clipText(body.Feedback, 1000),
	})
	if err != nil {
		var gatewayErr *gateway.Error
		if errors.As(err, &gatewayErr) {
			s.fail(w, errorStatus(gatewayErr.Code), gatewayErr.Code, gatewayErr.Message)
			return
		}
		log.Printf("[cv-builder] generate failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "server_error", "Máy chủ gặp lỗi khi tạo CV. Vui lòng thử lại.")
		return
	}

	log.Printf(
		"[cv-builder] ok model=%s provider=%s template=%s accent=%s duration=%s",
		modelID,
		result.Provider,
		result.Draft.Template,
		result.Draft.Accent,
		time.Since(startedAt).Round(time.Millisecond),
	)

	writeJSON(w, http.StatusOK, map[string]any{
		"input":    input,
		"content":  result.Draft.Content,
		"template": result.Draft.Template,
		"accent":   result.Draft.Accent,
		"modelId":  modelID,
		"provider": result.Provider,
	})
}

// normalizeBuilderInput giới hạn độ dài từng trường để prompt không phình to
// và chặn form rỗng khiến AI phải bịa nội dung.
func normalizeBuilderInput(input model.BuilderInput) (model.BuilderInput, string) {
	normalized := model.BuilderInput{
		FullName:  clipText(input.FullName, 120),
		Email:     clipText(input.Email, 160),
		Phone:     clipText(input.Phone, 40),
		Location:  clipText(input.Location, 120),
		LinkedIn:  clipText(input.LinkedIn, 300),
		GitHub:    clipText(input.GitHub, 300),
		Portfolio: clipText(input.Portfolio, 300),
		Position:  clipText(input.Position, 160),
		Level:     clipText(input.Level, 80),
		Years:     input.Years,
		Notes:     clipText(input.Notes, 2000),
		SourceID:  clipText(input.SourceID, 80),
	}
	if normalized.FullName == "" {
		return model.BuilderInput{}, "Nhập họ tên để AI tạo CV."
	}
	if normalized.Position == "" {
		return model.BuilderInput{}, "Nhập vị trí ứng tuyển để AI định hướng nội dung."
	}
	if normalized.Years < 0 {
		normalized.Years = 0
	}
	if normalized.Years > 60 {
		normalized.Years = 60
	}

	normalized.Skills = clipList(input.Skills, 40, 40)
	normalized.Certifications = clipList(input.Certifications, 12, 160)
	normalized.Languages = clipList(input.Languages, 8, 60)

	for _, item := range input.Experiences {
		entry := model.BuilderExperience{
			Company:     clipText(item.Company, 160),
			Role:        clipText(item.Role, 120),
			Period:      clipText(item.Period, 80),
			Description: clipText(item.Description, 1200),
		}
		if entry.Company == "" && entry.Role == "" && entry.Description == "" {
			continue
		}
		normalized.Experiences = append(normalized.Experiences, entry)
		if len(normalized.Experiences) == 10 {
			break
		}
	}

	for _, item := range input.Education {
		entry := model.BuilderEducation{
			School: clipText(item.School, 160),
			Degree: clipText(item.Degree, 120),
			Period: clipText(item.Period, 80),
		}
		if entry.School == "" {
			continue
		}
		normalized.Education = append(normalized.Education, entry)
		if len(normalized.Education) == 6 {
			break
		}
	}

	for _, item := range input.Projects {
		entry := model.BuilderProject{
			Name:        clipText(item.Name, 160),
			Role:        clipText(item.Role, 120),
			Period:      clipText(item.Period, 80),
			Description: clipText(item.Description, 1200),
		}
		if entry.Name == "" {
			continue
		}
		normalized.Projects = append(normalized.Projects, entry)
		if len(normalized.Projects) == 8 {
			break
		}
	}

	if len(normalized.Experiences) == 0 &&
		len(normalized.Education) == 0 &&
		len(normalized.Projects) == 0 &&
		len(normalized.Skills) == 0 {
		return model.BuilderInput{}, "Nhập ít nhất một kinh nghiệm, học vấn, dự án hoặc kỹ năng để AI có dữ kiện viết CV."
	}

	if normalized.Experiences == nil {
		normalized.Experiences = []model.BuilderExperience{}
	}
	if normalized.Education == nil {
		normalized.Education = []model.BuilderEducation{}
	}
	if normalized.Projects == nil {
		normalized.Projects = []model.BuilderProject{}
	}

	return normalized, ""
}

func clipText(value string, maxLength int) string {
	trimmed := strings.TrimSpace(value)
	runes := []rune(trimmed)
	if len(runes) <= maxLength {
		return trimmed
	}
	return strings.TrimSpace(string(runes[:maxLength]))
}

func clipList(values []string, maxItems, maxLength int) []string {
	result := make([]string, 0, min(maxItems, len(values)))
	seen := make(map[string]bool, len(values))
	for _, value := range values {
		text := clipText(value, maxLength)
		if text == "" {
			continue
		}
		key := strings.ToLower(text)
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, text)
		if len(result) == maxItems {
			break
		}
	}
	return result
}
