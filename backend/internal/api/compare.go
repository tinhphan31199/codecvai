package api

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"codecv/backend/internal/gateway"
	"codecv/backend/internal/model"
	"codecv/backend/internal/store"
)

const maxCompareMarketCVs = 3

type compareRequest struct {
	ModelID     string   `json:"modelId"`
	Language    string   `json:"language"`
	MyCvID      string   `json:"myCvId"`
	MarketCvIDs []string `json:"marketCvIds"`
}

type compareMeta struct {
	Model      string `json:"model"`
	Provider   string `json:"provider"`
	DurationMs int64  `json:"durationMs"`
	Compared   int    `json:"compared"`
}

type compareResponse struct {
	Mine     model.CompareCV    `json:"mine"`
	Others   []model.CompareCV  `json:"others"`
	Analysis model.CVComparison `json:"analysis"`
	Meta     compareMeta        `json:"meta"`
}

// handleCompareCVs compares one saved CV of the signed-in account with up to
// three marketplace CVs and returns the AI verdict; nothing is persisted.
func (s *Server) handleCompareCVs(w http.ResponseWriter, r *http.Request) {
	startedAt := time.Now()

	user, ok := userFromContext(r.Context())
	if !ok {
		s.unauthorized(w)
		return
	}

	var body compareRequest
	if err := decodeJSON(r, &body); err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}

	myCvID := strings.TrimSpace(body.MyCvID)
	if myCvID == "" {
		s.fail(w, http.StatusBadRequest, "bad_request", "Chọn CV của bạn để so sánh.")
		return
	}

	marketIDs := make([]string, 0, maxCompareMarketCVs)
	seen := make(map[string]bool, maxCompareMarketCVs)
	for _, raw := range body.MarketCvIDs {
		id := strings.TrimSpace(raw)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		marketIDs = append(marketIDs, id)
		if len(marketIDs) == maxCompareMarketCVs {
			break
		}
	}
	if len(marketIDs) == 0 {
		s.fail(w, http.StatusBadRequest, "bad_request", "Chọn ít nhất một CV trong chợ để so sánh.")
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

	cv, err := s.store.GeneratedCV(r.Context(), user.ID, myCvID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy CV của bạn. Tải lại danh sách rồi chọn lại.")
			return
		}
		s.storeError(w, err)
		return
	}

	viewer := marketViewer(r)
	others := make([]model.CompareCV, 0, len(marketIDs))
	for _, id := range marketIDs {
		market, err := s.store.MarketCV(r.Context(), id, viewer)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy CV trong chợ (đã bị xoá hoặc bạn không có quyền xem).")
				return
			}
			s.storeError(w, err)
			return
		}
		others = append(others, marketCompareProfile(market))
	}

	mine := generatedCompareProfile(cv)
	result, err := s.gateway.Compare(r.Context(), gateway.CompareRequest{
		ModelID:  modelID,
		Language: language,
		Mine:     mine,
		Others:   others,
	})
	if err != nil {
		var gatewayErr *gateway.Error
		if errors.As(err, &gatewayErr) {
			s.fail(w, errorStatus(gatewayErr.Code), gatewayErr.Code, gatewayErr.Message)
			return
		}
		log.Printf("[cv-compare] compare failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "server_error", "Máy chủ gặp lỗi khi so sánh CV. Vui lòng thử lại.")
		return
	}

	log.Printf(
		"[cv-compare] ok model=%s provider=%s market=%d duration=%s",
		modelID,
		result.Provider,
		len(others),
		time.Since(startedAt).Round(time.Millisecond),
	)

	writeJSON(w, http.StatusOK, compareResponse{
		Mine:     mine,
		Others:   others,
		Analysis: result.Comparison,
		Meta: compareMeta{
			Model:      modelID,
			Provider:   result.Provider,
			DurationMs: time.Since(startedAt).Milliseconds(),
			Compared:   len(others) + 1,
		},
	})
}

func generatedCompareProfile(cv model.GeneratedCV) model.CompareCV {
	name := strings.TrimSpace(cv.Name)
	if name == "" {
		name = strings.TrimSpace(cv.Input.FullName)
	}
	if name == "" {
		name = "CV của tôi"
	}

	title := strings.TrimSpace(cv.TargetPosition)
	if title == "" {
		title = strings.TrimSpace(cv.Input.Position)
	}
	if title == "" && len(cv.Content.Experience) > 0 {
		title = strings.TrimSpace(cv.Content.Experience[0].Role)
	}

	level := strings.TrimSpace(cv.Level)
	if level == "" {
		level = strings.TrimSpace(cv.Input.Level)
	}

	years := cv.Input.Years
	if years < 0 {
		years = 0
	}
	if years > 60 {
		years = 60
	}

	summary := strings.TrimSpace(cv.Content.Summary)
	if summary == "" {
		summary = strings.TrimSpace(cv.Input.Notes)
	}

	return model.CompareCV{
		ID:         cv.ID,
		Source:     "mine",
		Name:       name,
		Title:      title,
		Level:      level,
		Years:      years,
		Summary:    compareClip(summary, 600),
		Skills:     generatedCompareSkills(cv),
		Highlights: generatedCompareHighlights(cv),
	}
}

func marketCompareProfile(cv model.MarketCV) model.CompareCV {
	name := strings.TrimSpace(cv.Name)
	if name == "" {
		name = "CV trong chợ"
	}
	return model.CompareCV{
		ID:         cv.ID,
		Source:     "market",
		Name:       name,
		Title:      strings.TrimSpace(cv.Title),
		Level:      strings.TrimSpace(cv.Level),
		Years:      cv.Years,
		Category:   cv.Category,
		Summary:    cv.Summary,
		Skills:     cv.Skills,
		Highlights: cv.Highlights,
	}
}

func generatedCompareSkills(cv model.GeneratedCV) []string {
	skills := make([]string, 0, 14)
	seen := make(map[string]bool, 14)
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		key := strings.ToLower(value)
		if seen[key] {
			return
		}
		seen[key] = true
		skills = append(skills, compareClip(value, 40))
	}

	for _, skill := range cv.Input.Skills {
		add(skill)
	}
	for _, group := range cv.Content.Skills {
		for _, skill := range group.Items {
			add(skill)
		}
	}
	if len(skills) > 14 {
		skills = skills[:14]
	}
	return skills
}

func generatedCompareHighlights(cv model.GeneratedCV) []string {
	highlights := make([]string, 0, 4)
	add := func(value string) {
		value = compareClip(strings.TrimSpace(value), 240)
		if value == "" || len(highlights) == 4 {
			return
		}
		highlights = append(highlights, value)
	}

	for _, experience := range cv.Content.Experience {
		for _, bullet := range experience.Bullets {
			add(bullet)
			if len(highlights) >= 2 {
				break
			}
		}
		if len(highlights) >= 2 {
			break
		}
	}
	for _, project := range cv.Content.Projects {
		if len(highlights) >= 3 {
			break
		}
		for _, bullet := range project.Bullets {
			if strings.TrimSpace(bullet) != "" {
				add(bullet)
				break
			}
		}
	}
	if len(highlights) < 4 {
		names := make([]string, 0, 2)
		for _, certification := range cv.Content.Certifications {
			if name := strings.TrimSpace(certification.Name); name != "" {
				names = append(names, name)
			}
			if len(names) == 2 {
				break
			}
		}
		if len(names) > 0 {
			add("Chứng chỉ: " + strings.Join(names, ", "))
		}
	}
	return highlights
}

func compareClip(value string, maxLength int) string {
	runes := []rune(value)
	if len(runes) <= maxLength {
		return value
	}
	return string(runes[:maxLength])
}
