package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"slices"
	"strings"
	"time"

	"codecv/backend/internal/cvextract"
	"codecv/backend/internal/gateway"
	"codecv/backend/internal/github"
	"codecv/backend/internal/links"
	"codecv/backend/internal/model"
	"codecv/backend/internal/positions"
	"codecv/backend/internal/store"
)

const (
	maxFileBytes = 10 << 20
	maxOverhead  = 2 << 20
)

var defaultLevels = []string{"Junior", "Middle", "Senior"}

type Config struct {
	AllowedOrigins []string
	Store          *store.Store
}

type Server struct {
	gateway        *gateway.Gateway
	allowedOrigins []string
	store          *store.Store
}

func New(cfg Config) http.Handler {
	server := &Server{
		gateway:        gateway.New(cfg.Store),
		allowedOrigins: cfg.AllowedOrigins,
		store:          cfg.Store,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", server.handleHealth)
	mux.HandleFunc("POST /api/analyze-cv", server.handleAnalyze)

	mux.HandleFunc("GET /api/workspace", withStore(server, server.handleWorkspace))
	mux.HandleFunc("PUT /api/workspace", withStore(server, server.handleWorkspace))
	mux.HandleFunc("GET /api/stats", withStore(server, server.handleStats))
	mux.HandleFunc("GET /api/dashboard", withStore(server, server.handleDashboard))
	mux.HandleFunc("GET /api/candidates", withStore(server, server.handleCandidates))
	mux.HandleFunc("GET /api/candidates/{id}", withStore(server, server.handleCandidate))
	mux.HandleFunc("PATCH /api/candidates/{id}", withStore(server, server.handleCandidate))
	mux.HandleFunc("GET /api/candidates/{id}/repository", withStore(server, server.handleRepository))
	mux.HandleFunc("GET /api/candidates/{id}/questions", withStore(server, server.handleQuestions))
	mux.HandleFunc("PATCH /api/candidates/{id}/findings/{findingId}", withStore(server, server.handleFinding))
	mux.HandleFunc("GET /api/positions", withStore(server, server.handlePositions))
	mux.HandleFunc("POST /api/positions", withStore(server, server.handlePositions))
	mux.HandleFunc("GET /api/positions/{id}", withStore(server, server.handlePosition))
	mux.HandleFunc("PUT /api/positions/{id}", withStore(server, server.handlePosition))
	mux.HandleFunc("DELETE /api/positions/{id}", withStore(server, server.handlePosition))
	mux.HandleFunc("GET /api/reports", withStore(server, server.handleReports))
	mux.HandleFunc("GET /api/reports/{id}", withStore(server, server.handleReport))
	mux.HandleFunc("PATCH /api/reports/{id}", withStore(server, server.handleReport))
	mux.HandleFunc("GET /api/team", withStore(server, server.handleTeam))
	mux.HandleFunc("POST /api/team", withStore(server, server.handleTeam))
	mux.HandleFunc("PUT /api/team/{name}", withStore(server, server.handleTeamMember))
	mux.HandleFunc("DELETE /api/team/{name}", withStore(server, server.handleTeamMember))
	mux.HandleFunc("POST /api/gemini/models", withStore(server, server.handleGeminiModels))
	mux.HandleFunc("GET /api/models", withStore(server, server.handleModels))
	mux.HandleFunc("POST /api/models", withStore(server, server.handleModels))
	mux.HandleFunc("PUT /api/models/{id}", withStore(server, server.handleModel))
	mux.HandleFunc("DELETE /api/models/{id}", withStore(server, server.handleModel))
	mux.HandleFunc("GET /api/service-configs", withStore(server, server.handleServiceConfigs))
	mux.HandleFunc("PUT /api/service-configs/{id}", withStore(server, server.handleServiceConfig))
	mux.HandleFunc("GET /api/stages", withStore(server, server.handleStages))
	mux.HandleFunc("POST /api/stages", withStore(server, server.handleStages))
	mux.HandleFunc("PUT /api/stages/{id}", withStore(server, server.handleStage))
	mux.HandleFunc("DELETE /api/stages/{id}", withStore(server, server.handleStage))
	mux.HandleFunc("GET /api/levels", withStore(server, server.handleLevels))
	mux.HandleFunc("POST /api/levels", withStore(server, server.handleLevels))
	mux.HandleFunc("PUT /api/levels/{name}", withStore(server, server.handleLevel))
	mux.HandleFunc("DELETE /api/levels/{name}", withStore(server, server.handleLevel))

	return recoverer(cors(cfg.AllowedOrigins, mux))
}

func withStore(server *Server, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if server.store == nil {
			server.fail(w, http.StatusServiceUnavailable, "missing_db", "Máy chủ chưa kết nối cơ sở dữ liệu. Kiểm tra DATABASE_URL và khởi động lại server.")
			return
		}
		next(w, r)
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleAnalyze(w http.ResponseWriter, r *http.Request) {
	startedAt := time.Now()

	if s.store == nil {
		s.fail(w, http.StatusServiceUnavailable, "missing_db", "Máy chủ chưa kết nối cơ sở dữ liệu. Kiểm tra DATABASE_URL và khởi động lại server.")
		return
	}

	if r.ContentLength > maxFileBytes+maxOverhead {
		s.fail(w, http.StatusRequestEntityTooLarge, "too_large", "Tệp vượt quá 10 MB. Nén hoặc xuất lại CV rồi thử lại.")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxFileBytes+maxOverhead)
	if err := r.ParseMultipartForm(maxFileBytes); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			s.fail(w, http.StatusRequestEntityTooLarge, "too_large", "Tệp vượt quá 10 MB. Nén hoặc xuất lại CV rồi thử lại.")
			return
		}
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}
	defer r.MultipartForm.RemoveAll()

	file, header, err := r.FormFile("file")
	if err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Thiếu tệp CV trong yêu cầu.")
		return
	}
	defer file.Close()

	if header.Size == 0 {
		s.fail(w, http.StatusBadRequest, "bad_request", "Tệp CV rỗng. Chọn tệp khác.")
		return
	}
	if header.Size > maxFileBytes {
		s.fail(w, http.StatusRequestEntityTooLarge, "too_large", "Tệp vượt quá 10 MB. Nén hoặc xuất lại CV rồi thử lại.")
		return
	}

	buffer, err := io.ReadAll(io.LimitReader(file, maxFileBytes+1))
	if err != nil {
		s.fail(w, http.StatusBadRequest, "bad_request", "Không đọc được dữ liệu gửi lên.")
		return
	}
	if len(buffer) == 0 {
		s.fail(w, http.StatusBadRequest, "bad_request", "Tệp CV rỗng. Chọn tệp khác.")
		return
	}
	if len(buffer) > maxFileBytes {
		s.fail(w, http.StatusRequestEntityTooLarge, "too_large", "Tệp vượt quá 10 MB. Nén hoặc xuất lại CV rồi thử lại.")
		return
	}

	fileType, supported := cvextract.Detect(header.Filename, header.Header.Get("Content-Type"))
	if !supported {
		s.fail(w, http.StatusUnsupportedMediaType, "unsupported_type", "Chỉ hỗ trợ CV định dạng PDF hoặc DOCX.")
		return
	}

	position, found := s.promptPosition(r.Context(), r.FormValue("positionId"))
	if !found {
		s.fail(w, http.StatusBadRequest, "bad_request", "Vị trí đối chiếu không hợp lệ. Chọn lại vị trí trong cấu hình.")
		return
	}

	level := r.FormValue("level")
	levelOptions := s.levelOptions(r.Context())
	if !slices.Contains(levelOptions, level) {
		level = position.Level
	}
	if !slices.Contains(levelOptions, level) {
		level = levelOptions[0]
	}

	language := "vi"
	if r.FormValue("language") == "English" {
		language = "en"
	}

	modelID := strings.TrimSpace(r.FormValue("model"))
	includeQuestions := r.FormValue("includeQuestions") != "false"

	var (
		extracted cvextract.Result
		cvFile    []byte
	)

	if fileType == cvextract.TypePDF {
		extracted = cvextract.BestEffort(buffer, fileType)
		cvFile = buffer
	} else {
		extracted, err = cvextract.Extract(buffer, fileType)
		if err != nil {
			var extractionErr *cvextract.Error
			if errors.As(err, &extractionErr) {
				s.fail(w, http.StatusUnprocessableEntity, extractionErr.Code, extractionErr.Message)
				return
			}
			log.Printf("[analyze-cv] extraction failed: %v", err)
			s.fail(w, http.StatusUnprocessableEntity, "no_text", "Không đọc được nội dung tệp. Kiểm tra lại định dạng CV.")
			return
		}
	}

	extraction := links.Extract(extracted.Text)
	evidence := s.githubEvidence(r.Context(), extraction)

	result, err := s.gateway.Analyze(r.Context(), gateway.Request{
		ModelID:          modelID,
		CVText:           extracted.Text,
		CVFile:           cvFile,
		CVFileName:       header.Filename,
		Repositories:     evidence.Repositories,
		GithubContext:    evidence.Context,
		Position:         position,
		Level:            level,
		Language:         language,
		IncludeQuestions: includeQuestions,
	})
	if err != nil {
		var gatewayErr *gateway.Error
		if errors.As(err, &gatewayErr) {
			s.fail(w, errorStatus(gatewayErr.Code), gatewayErr.Code, gatewayErr.Message)
			return
		}
		log.Printf("[analyze-cv] analysis failed: %v", err)
		s.fail(w, http.StatusInternalServerError, "server_error", "Máy chủ gặp lỗi khi phân tích CV. Vui lòng thử lại.")
		return
	}

	log.Printf(
		"[analyze-cv] ok model=%s provider=%s github=%d/%d duration=%s",
		modelID,
		result.Provider,
		evidence.Meta.Analyzed,
		evidence.Meta.Targets,
		time.Since(startedAt).Round(time.Millisecond),
	)

	if _, err := s.store.SaveAnalysis(r.Context(), store.SaveAnalysisInput{
		Position: position.Title,
		Level:    level,
		Model:    modelID,
		Analysis: result.Analysis,
	}); err != nil {
		log.Printf("[analyze-cv] persist failed: %v", err)
	}

	writeJSON(w, http.StatusOK, model.Response{
		Analysis: result.Analysis,
		Meta: model.Meta{
			Model:      modelID,
			Pages:      extracted.Pages,
			Characters: extracted.Characters,
			DurationMs: time.Since(startedAt).Milliseconds(),
			Truncated:  extracted.Truncated,
			Github:     evidence.Meta,
		},
	})
}

// GitHub đọc cấu hình từ DB mỗi lần phân tích; thiếu cấu hình thì dùng mặc định công khai.
func (s *Server) githubEvidence(ctx context.Context, extraction links.Extraction) github.Evidence {
	baseURL := "https://api.github.com"
	token := ""
	if s.store != nil {
		cfg, err := s.store.ServiceConfig(ctx, "github")
		switch {
		case err == nil:
			if trimmed := strings.TrimSpace(cfg.BaseURL); trimmed != "" {
				baseURL = trimmed
			}
			token = strings.TrimSpace(cfg.APIKey)
		case !errors.Is(err, store.ErrNotFound):
			log.Printf("[analyze-cv] github config lookup failed: %v", err)
		}
	}
	return github.New(baseURL, token).Evidence(ctx, extraction)
}

// Base URL và key của provider AI cũng nằm ở DB; fallback chỉ để server vẫn chạy khi thiếu dòng cấu hình.
func (s *Server) serviceConfig(ctx context.Context, id, fallbackBaseURL string) (baseURL, key string) {
	baseURL = fallbackBaseURL
	if s.store == nil {
		return baseURL, ""
	}
	cfg, err := s.store.ServiceConfig(ctx, id)
	if err != nil {
		if !errors.Is(err, store.ErrNotFound) {
			log.Printf("[api] %s config lookup failed: %v", id, err)
		}
		return baseURL, ""
	}
	if trimmed := strings.TrimSpace(cfg.BaseURL); trimmed != "" {
		baseURL = trimmed
	}
	return baseURL, strings.TrimSpace(cfg.APIKey)
}

// Vị trí do người dùng tạo nằm ở DB; danh mục nhúng chỉ còn là fallback.
func (s *Server) promptPosition(ctx context.Context, id string) (positions.Position, bool) {
	if s.store != nil {
		pos, err := s.store.Position(ctx, id)
		switch {
		case err == nil:
			return promptPositionFromRecord(pos), true
		case !errors.Is(err, store.ErrNotFound):
			log.Printf("[analyze-cv] position lookup failed: %v", err)
		}
	}
	return positions.Find(id)
}

func promptPositionFromRecord(pos model.Position) positions.Position {
	criteria := make([]positions.Criterion, 0, len(pos.Criteria))
	for _, crit := range pos.Criteria {
		criteria = append(criteria, positions.Criterion{Label: crit.Label, Kind: crit.Kind})
	}
	return positions.Position{
		ID:          pos.ID,
		Title:       pos.Title,
		Team:        pos.Team,
		Level:       pos.Level,
		Description: pos.Description,
		Criteria:    criteria,
	}
}

// Cấp bậc do người dùng quản lý ở bảng levels; danh mục mặc định chỉ là fallback.
func (s *Server) levelOptions(ctx context.Context) []string {
	if s.store != nil {
		levels, err := s.store.Levels(ctx)
		switch {
		case err == nil && len(levels) > 0:
			names := make([]string, len(levels))
			for i, level := range levels {
				names[i] = level.Name
			}
			return names
		case err != nil:
			log.Printf("[analyze-cv] level lookup failed: %v", err)
		}
	}
	return defaultLevels
}

func (s *Server) fail(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, model.ErrorBody{
		Error: model.ErrorDetail{Code: code, Message: message},
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("[api] cannot encode response: %v", err)
	}
}

func errorStatus(code string) int {
	switch code {
	case "too_large":
		return http.StatusRequestEntityTooLarge
	case "unsupported_type":
		return http.StatusUnsupportedMediaType
	case "no_text":
		return http.StatusUnprocessableEntity
	case "missing_key":
		return http.StatusServiceUnavailable
	case "upstream_error", "invalid_output":
		return http.StatusBadGateway
	default:
		return http.StatusBadRequest
	}
}

func cors(allowedOrigins []string, next http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	allowAny := false
	for _, origin := range allowedOrigins {
		trimmed := strings.TrimSpace(strings.TrimRight(origin, "/"))
		if trimmed == "" {
			continue
		}
		if trimmed == "*" {
			allowAny = true
			continue
		}
		allowed[trimmed] = struct{}{}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimRight(r.Header.Get("Origin"), "/")
		if origin != "" {
			_, permitted := allowed[origin]
			if permitted || allowAny {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Add("Vary", "Origin")
				if r.Method == http.MethodOptions {
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
					w.Header().Set("Access-Control-Max-Age", "600")
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}

func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				log.Printf("[api] panic on %s %s: %v", r.Method, r.URL.Path, recovered)
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = fmt.Fprint(w, `{"error":{"code":"server_error","message":"Máy chủ gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại."}}`)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
