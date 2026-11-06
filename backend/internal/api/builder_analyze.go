package api

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"codecv/backend/internal/analysis"
	"codecv/backend/internal/gateway"
	"codecv/backend/internal/model"
	"codecv/backend/internal/positions"
)

// handleBuilderAnalyze chấm bản nháp CV builder như một CV thật: đối chiếu với
// tiêu chí của vị trí ứng tuyển rồi trả kết quả ngay, không lưu vào hồ sơ.
func (s *Server) handleBuilderAnalyze(w http.ResponseWriter, r *http.Request) {
	startedAt := time.Now()

	var body struct {
		ModelID  string                   `json:"modelId"`
		Language string                   `json:"language"`
		Input    model.BuilderInput       `json:"input"`
		Content  model.GeneratedCVContent `json:"content"`
	}
	if err := decodeJSON(r, &body); err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}

	input := clipBuilderInput(body.Input)
	if input.Position == "" {
		s.fail(w, http.StatusBadRequest, "bad_request", "Nhập vị trí ứng tuyển để phân tích CV.")
		return
	}
	if analysis.GeneratedDraftEmpty(model.GeneratedCVDraft{Content: body.Content}) {
		s.fail(w, http.StatusBadRequest, "bad_request", "Chưa có nội dung CV để phân tích. Tạo CV bằng AI trước.")
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

	position := s.reviewPosition(r.Context(), input.Position, input.Level, language)
	level := strings.TrimSpace(input.Level)
	if level == "" {
		level = strings.TrimSpace(position.Level)
	}

	result, err := s.gateway.Analyze(r.Context(), gateway.Request{
		ModelID:          modelID,
		CVText:           analysis.GeneratedCVText(input, body.Content),
		Position:         position,
		Level:            level,
		Language:         language,
		IncludeQuestions: false,
	})
	if err != nil {
		var gatewayErr *gateway.Error
		if errors.As(err, &gatewayErr) {
			s.fail(w, errorStatus(gatewayErr.Code), gatewayErr.Code, gatewayErr.Message)
			return
		}
		log.Printf("[cv-builder] analyze failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "server_error", "Máy chủ gặp lỗi khi phân tích CV. Vui lòng thử lại.")
		return
	}

	log.Printf(
		"[cv-builder] analyze ok model=%s provider=%s criteria=%d duration=%s",
		modelID,
		result.Provider,
		len(result.Analysis.Criteria),
		time.Since(startedAt).Round(time.Millisecond),
	)

	writeJSON(w, http.StatusOK, model.Response{
		Analysis: result.Analysis,
		Meta: model.Meta{
			Model:      modelID,
			DurationMs: time.Since(startedAt).Milliseconds(),
		},
	})
}

// reviewPosition khớp tiêu đề vị trí với danh mục do người dùng quản lý; tên cũ
// hoặc nhập tự do không khớp thì chấm bằng bộ tiêu chí chung để nút luôn dùng được.
func (s *Server) reviewPosition(ctx context.Context, title, level, language string) positions.Position {
	title = strings.TrimSpace(title)
	candidates := make([]positions.Position, 0, 80)
	if s.store != nil {
		records, err := s.store.Positions(ctx)
		if err != nil {
			log.Printf("[cv-builder] position lookup failed: %v", err)
		}
		for _, record := range records {
			candidates = append(candidates, promptPositionFromRecord(record))
		}
	}
	candidates = append(candidates, positions.All()...)

	if position, ok := matchReviewPosition(candidates, title, level); ok {
		return position
	}
	return syntheticReviewPosition(title, level, language)
}

func matchReviewPosition(candidates []positions.Position, title, level string) (positions.Position, bool) {
	titleKey := strings.ToLower(strings.TrimSpace(title))
	var fallback *positions.Position
	for index := range candidates {
		position := &candidates[index]
		if strings.ToLower(strings.TrimSpace(position.Title)) != titleKey {
			continue
		}
		if fallback == nil {
			fallback = position
		}
		if level != "" && strings.EqualFold(strings.TrimSpace(position.Level), level) {
			return *position, true
		}
	}
	if fallback != nil {
		return *fallback, true
	}
	return positions.Position{}, false
}

func syntheticReviewPosition(title, level, language string) positions.Position {
	position := positions.Position{
		Title:       title,
		Team:        "Ứng tuyển",
		Level:       level,
		Description: fmt.Sprintf("CV ứng tuyển vị trí %s.", title),
		Criteria: []positions.Criterion{
			{Label: "Kinh nghiệm phù hợp với vị trí ứng tuyển", Kind: model.CriterionMust},
			{Label: "Kỹ năng kỹ thuật cốt lõi của vị trí", Kind: model.CriterionMust},
			{Label: "Thành tích và kết quả đo lường được", Kind: model.CriterionNice},
			{Label: "Học vấn, chứng chỉ và ngoại ngữ", Kind: model.CriterionNice},
			{Label: "Trình bày rõ ràng, thân thiện ATS", Kind: model.CriterionNice},
		},
	}
	if language == "en" {
		position.Team = "Application"
		position.Description = fmt.Sprintf("CV for the %s role.", title)
		position.Criteria = []positions.Criterion{
			{Label: "Relevant experience for the target role", Kind: model.CriterionMust},
			{Label: "Core technical skills for the role", Kind: model.CriterionMust},
			{Label: "Measurable achievements and outcomes", Kind: model.CriterionNice},
			{Label: "Education, certifications and languages", Kind: model.CriterionNice},
			{Label: "Clear, ATS-friendly presentation", Kind: model.CriterionNice},
		}
	}
	return position
}
