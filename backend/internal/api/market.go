package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"codecv/backend/internal/cvextract"
	"codecv/backend/internal/gateway"
	"codecv/backend/internal/model"
	"codecv/backend/internal/storage"
	"codecv/backend/internal/store"
)

// The marketplace is a shared CV pool: every signed-in account can browse and
// add CVs, unlike the per-owner candidate pipeline.
func (s *Server) handleMarketCVs(w http.ResponseWriter, r *http.Request) {
	limit := 200
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}

	cvs, err := s.store.MarketCVs(r.Context(), marketViewer(r), limit)
	if err != nil {
		log.Printf("[market] list failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "store_error", "Không tải được chợ CV. Vui lòng thử lại.")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": cvs,
		"total": len(cvs),
	})
}

func (s *Server) handleMarketUpload(w http.ResponseWriter, r *http.Request) {
	startedAt := time.Now()

	upload, ok := s.readCVUpload(w, r)
	if !ok {
		return
	}

	language := "vi"
	switch strings.ToLower(strings.TrimSpace(r.FormValue("language"))) {
	case "en", "english":
		language = "en"
	}

	visibility := "public"
	switch strings.ToLower(strings.TrimSpace(r.FormValue("visibility"))) {
	case "private", "hidden":
		visibility = "private"
	}

	modelID := strings.TrimSpace(r.FormValue("model"))
	if modelID == "" {
		modelID = s.defaultAnalysisModel(r.Context())
	}
	if modelID == "" {
		s.fail(w, http.StatusBadRequest, "bad_request", "Chưa có model AI đang bật. Bật model trong Cài đặt → AI models.")
		return
	}

	var (
		extracted cvextract.Result
		err       error
	)
	if upload.fileType == cvextract.TypePDF {
		extracted = cvextract.BestEffort(upload.buffer, upload.fileType)
	} else {
		extracted, err = cvextract.Extract(upload.buffer, upload.fileType)
		if err != nil {
			var extractionErr *cvextract.Error
			if errors.As(err, &extractionErr) {
				s.fail(w, http.StatusUnprocessableEntity, extractionErr.Code, extractionErr.Message)
				return
			}
			log.Printf("[market] extraction failed: %v", err)
			s.fail(w, http.StatusUnprocessableEntity, "no_text", "Không đọc được nội dung tệp. Kiểm tra lại định dạng CV.")
			return
		}
	}

	var cvFile []byte
	if upload.fileType == cvextract.TypePDF {
		cvFile = upload.buffer
	}

	result, err := s.gateway.Categorize(r.Context(), gateway.MarketRequest{
		ModelID:    modelID,
		CVText:     extracted.Text,
		CVFile:     cvFile,
		CVFileName: upload.fileName,
		Language:   language,
		Levels:     s.levelOptions(r.Context()),
	})
	if err != nil {
		var gatewayErr *gateway.Error
		if errors.As(err, &gatewayErr) {
			s.fail(w, errorStatus(gatewayErr.Code), gatewayErr.Code, gatewayErr.Message)
			return
		}
		log.Printf("[market] categorize failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "server_error", "Máy chủ gặp lỗi khi phân loại CV. Vui lòng thử lại.")
		return
	}

	cvKey := s.storeCV(r.Context(), upload.fileType, upload.fileName, upload.buffer)

	user, _ := userFromContext(r.Context())
	saved, err := s.store.SaveMarketCV(r.Context(), store.SaveMarketCVInput{
		OwnerID:    user.ID,
		FileName:   upload.fileName,
		CVKey:      cvKey,
		Model:      modelID,
		Visibility: visibility,
		Profile:    result.Profile,
	})
	if err != nil {
		log.Printf("[market] persist failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "store_error", "Không lưu được CV vào chợ. Vui lòng thử lại.")
		return
	}

	log.Printf(
		"[market] ok model=%s provider=%s category=%s level=%s visibility=%s chars=%d duration=%s",
		modelID,
		result.Provider,
		result.Profile.Category,
		result.Profile.Level,
		visibility,
		extracted.Characters,
		time.Since(startedAt).Round(time.Millisecond),
	)

	writeJSON(w, http.StatusOK, map[string]any{
		"cv":         saved,
		"provider":   result.Provider,
		"durationMs": time.Since(startedAt).Milliseconds(),
	})
}

// handleMarketCV serves one CV: read, change visibility, or delete.
func (s *Server) handleMarketCV(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	viewer := marketViewer(r)

	switch r.Method {
	case http.MethodGet:
		cv, err := s.store.MarketCV(r.Context(), id, viewer)
		if err != nil {
			s.marketError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, cv)

	case http.MethodPatch:
		var patch struct {
			Visibility string `json:"visibility"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&patch); err != nil {
			s.fail(w, http.StatusBadRequest, "bad_request", "Dữ liệu cập nhật không hợp lệ.")
			return
		}
		visibility := strings.ToLower(strings.TrimSpace(patch.Visibility))
		if visibility != "public" && visibility != "private" {
			s.fail(w, http.StatusBadRequest, "bad_request", "Trạng thái hiển thị không hợp lệ.")
			return
		}
		cv, err := s.store.SetMarketCVVisibility(r.Context(), id, viewer.UserID, viewer.Admin, visibility)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy CV hoặc bạn không có quyền thay đổi.")
				return
			}
			s.storeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, cv)

	case http.MethodDelete:
		cvKey, err := s.store.DeleteMarketCV(r.Context(), id, viewer.UserID, viewer.Admin)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy CV hoặc bạn không có quyền xoá.")
				return
			}
			s.storeError(w, err)
			return
		}
		if cvKey != "" && s.cvStorage != nil {
			ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 10*time.Second)
			defer cancel()
			if err := s.cvStorage.Delete(ctx, cvKey); err != nil {
				log.Printf("[market] cv object cleanup failed: %v", err)
			}
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		s.fail(w, http.StatusMethodNotAllowed, "method_not_allowed", "Phương thức không được hỗ trợ.")
	}
}

// handleMarketCVSave toggles the viewer's bookmark: POST saves, DELETE removes.
func (s *Server) handleMarketCVSave(w http.ResponseWriter, r *http.Request) {
	user, ok := userFromContext(r.Context())
	if !ok {
		s.unauthorized(w)
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	saved := r.Method == http.MethodPost

	if saved {
		if _, err := s.store.MarketCV(r.Context(), id, marketViewer(r)); err != nil {
			s.marketError(w, err)
			return
		}
	}
	if err := s.store.SetMarketCVSaved(r.Context(), id, user.ID, saved); err != nil {
		s.storeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"saved": saved})
}

// handleMarketCVFile streams the original CV; the bucket key never reaches the client.
func (s *Server) handleMarketCVFile(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	key, fileName, err := s.store.MarketCVFile(r.Context(), id, marketViewer(r))
	if err != nil {
		s.marketError(w, err)
		return
	}
	if key == "" {
		s.fail(w, http.StatusNotFound, "no_cv", "CV này chưa có bản gốc được lưu.")
		return
	}
	if s.cvStorage == nil {
		s.fail(w, http.StatusServiceUnavailable, "storage_unavailable", "Máy chủ chưa cấu hình kho lưu CV. Kiểm tra AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY và S3_BUCKET.")
		return
	}

	object, err := s.cvStorage.Get(r.Context(), key)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			s.fail(w, http.StatusNotFound, "no_cv", "Không tìm thấy bản CV gốc trên kho lưu trữ.")
			return
		}
		log.Printf("[market] cv download failed: %v", err)
		s.fail(w, http.StatusBadGateway, "storage_error", "Không đọc được bản CV gốc. Vui lòng thử lại.")
		return
	}
	defer object.Body.Close()

	if fileName == "" {
		fileName = path.Base(key)
	}
	contentType := object.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	disposition := mime.FormatMediaType("attachment", map[string]string{"filename": fileName})
	if disposition == "" {
		disposition = "attachment"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", disposition)
	w.Header().Set("Cache-Control", "private, no-store")
	if object.Size > 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(object.Size, 10))
	}
	if _, err := io.Copy(w, object.Body); err != nil {
		log.Printf("[market] cv stream failed: %v", err)
	}
}

func marketViewer(r *http.Request) store.MarketViewer {
	user, _ := userFromContext(r.Context())
	return store.MarketViewer{UserID: user.ID, Admin: user.Role == model.RoleAdmin}
}

func (s *Server) marketError(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrNotFound) {
		s.fail(w, http.StatusNotFound, "not_found", "Không tìm thấy CV trong chợ.")
		return
	}
	s.storeError(w, err)
}

func (s *Server) defaultAnalysisModel(ctx context.Context) string {
	if s.store == nil {
		return ""
	}
	models, err := s.store.Models(ctx)
	if err != nil {
		log.Printf("[market] model lookup failed: %v", err)
		return ""
	}
	for _, item := range models {
		if item.Active {
			return item.ID
		}
	}
	return ""
}
