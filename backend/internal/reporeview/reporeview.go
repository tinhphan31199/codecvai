// Package reporeview asks the configured AI model to review a sample of a
// scanned repository and turns the answer into findings tied to real file
// lines. It never invents code: the snippet shown next to a finding is cut
// from the file content that was actually read.
package reporeview

import (
	"encoding/json"
	"fmt"
	"path"
	"sort"
	"strings"

	"codecv/backend/internal/model"
)

const (
	// MaxFiles caps how many blobs one review reads from GitHub.
	MaxFiles = 6
	// maxFileLines caps how much of one file is sent to the model.
	maxFileLines = 400
	// maxFindings caps the findings stored for one repository.
	maxFindings = 6
	// windowRadius is the number of context lines around a finding.
	windowRadius = 6
)

// File is one blob already fetched from GitHub.
type File struct {
	Path    string
	Content string
}

// Input carries everything the model needs to judge the sample.
type Input struct {
	RepositoryURL string
	Description   string
	Languages     string
	Readme        string
	Summary       *model.RepoSummary
	Files         []File
}

var reviewExtensions = map[string]struct{}{
	".go": {}, ".ts": {}, ".tsx": {}, ".js": {}, ".jsx": {}, ".mjs": {}, ".cjs": {},
	".py": {}, ".rb": {}, ".java": {}, ".kt": {}, ".kts": {}, ".cs": {}, ".rs": {},
	".php": {}, ".swift": {}, ".dart": {}, ".vue": {}, ".svelte": {}, ".scala": {},
	".sql": {},
}

var skipDirs = map[string]struct{}{
	"node_modules": {}, "vendor": {}, "dist": {}, "build": {}, "out": {},
	".next": {}, ".nuxt": {}, "target": {}, "bin": {}, "obj": {}, ".git": {},
	"coverage": {}, "__pycache__": {}, ".venv": {}, "venv": {}, "site-packages": {},
	"pods": {}, "deriveddata": {}, ".idea": {}, ".vscode": {}, "tmp": {}, "temp": {},
	"third_party": {}, "thirdparty": {},
}

var skipSuffixes = []string{".min.js", ".min.mjs", ".map", ".d.ts", ".pb.go", "_generated.go", ".gen.go", ".g.dart", ".designer.cs"}

var sourceRoots = map[string]struct{}{
	"src": {}, "lib": {}, "internal": {}, "app": {}, "cmd": {}, "pkg": {},
	"server": {}, "backend": {}, "frontend": {}, "api": {}, "services": {},
}

var nameHints = []string{"main.", "server.", "handler", "service", "controller", "route", "auth", "middleware", "api", "index."}

type ranked struct {
	path   string
	module string
	score  int
}

// Plan picks the source files most worth reviewing, best first. Tests are
// included only when there are not enough production files.
func Plan(tree []model.RepoTreeNode, summary *model.RepoSummary, maxFiles int) []string {
	if maxFiles <= 0 {
		maxFiles = MaxFiles
	}
	entrypoints := map[string]struct{}{}
	if summary != nil {
		for _, entry := range summary.Entrypoints {
			entrypoints[strings.ToLower(entry)] = struct{}{}
		}
	}

	items := make([]ranked, 0)
	var walk func([]model.RepoTreeNode, string)
	walk = func(nodes []model.RepoTreeNode, prefix string) {
		for _, node := range nodes {
			full := node.Name
			if prefix != "" {
				full = prefix + "/" + node.Name
			}
			if node.Type == "folder" {
				if skipFolder(node.Name) {
					continue
				}
				walk(node.Children, full)
				continue
			}
			if node.Type != "file" || !worthReviewing(full) {
				continue
			}
			items = append(items, ranked{
				path:   full,
				module: topModule(full),
				score:  scoreFile(full, node.Size, entrypoints),
			})
		}
	}
	walk(tree, "")

	sort.Slice(items, func(i, j int) bool {
		if items[i].score != items[j].score {
			return items[i].score > items[j].score
		}
		return items[i].path < items[j].path
	})

	// Two files per top-level module keeps a monorepo mix instead of eight
	// files from the same folder.
	chosen := make([]string, 0, maxFiles)
	perModule := map[string]int{}
	leftover := make([]ranked, 0)
	for _, item := range items {
		if len(chosen) >= maxFiles {
			break
		}
		if perModule[item.module] >= 2 {
			leftover = append(leftover, item)
			continue
		}
		perModule[item.module]++
		chosen = append(chosen, item.path)
	}
	for _, item := range leftover {
		if len(chosen) >= maxFiles {
			break
		}
		chosen = append(chosen, item.path)
	}
	return chosen
}

// BlobSHA finds the blob SHA of one file inside a stored tree.
func BlobSHA(tree []model.RepoTreeNode, filePath string) string {
	parts := strings.Split(strings.TrimPrefix(filePath, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		return ""
	}
	var walk func([]model.RepoTreeNode, int) string
	walk = func(level []model.RepoTreeNode, depth int) string {
		for _, node := range level {
			if node.Name != parts[depth] {
				continue
			}
			if depth == len(parts)-1 {
				if node.Type == "file" {
					return node.SHA
				}
				return ""
			}
			if node.Type == "folder" {
				return walk(node.Children, depth+1)
			}
			return ""
		}
		return ""
	}
	return walk(tree, 0)
}

func skipFolder(name string) bool {
	lower := strings.ToLower(name)
	if _, ok := skipDirs[lower]; ok {
		return true
	}
	return strings.HasPrefix(lower, ".")
}

func worthReviewing(full string) bool {
	lower := strings.ToLower(full)
	for _, segment := range strings.Split(lower, "/") {
		if _, ok := skipDirs[segment]; ok {
			return false
		}
	}
	base := path.Base(lower)
	for _, suffix := range skipSuffixes {
		if strings.HasSuffix(base, suffix) {
			return false
		}
	}
	_, ok := reviewExtensions[path.Ext(base)]
	return ok
}

func topModule(full string) string {
	if index := strings.Index(full, "/"); index > 0 {
		return strings.ToLower(full[:index])
	}
	return ""
}

func scoreFile(full string, size int64, entrypoints map[string]struct{}) int {
	lower := strings.ToLower(full)
	score := 50
	if _, ok := entrypoints[lower]; ok {
		score += 80
	}
	if _, ok := sourceRoots[topModule(full)]; ok {
		score += 15
	}
	score -= 3 * strings.Count(lower, "/")
	if isTestPath(lower) {
		score -= 40
	}
	base := path.Base(lower)
	for _, hint := range nameHints {
		if strings.Contains(base, hint) {
			score += 8
			break
		}
	}
	switch {
	case size > 0 && size < 200:
		score -= 15
	case size > 80000:
		score -= 25
	}
	return score
}

func isTestPath(lower string) bool {
	base := path.Base(lower)
	switch {
	case strings.Contains(base, ".test."), strings.Contains(base, ".spec."),
		strings.Contains(base, "_test."), strings.Contains(base, "_spec."):
		return true
	case strings.HasPrefix(base, "test_") || strings.HasPrefix(base, "test-"):
		return true
	}
	for _, dir := range []string{"test/", "tests/", "__tests__/", "spec/"} {
		if strings.HasPrefix(lower, dir) || strings.Contains(lower, "/"+dir) {
			return true
		}
	}
	return false
}

// SystemInstruction steers every provider to the same JSON contract.
const SystemInstruction = "Bạn là kỹ sư phần mềm cấp cao đang đánh giá mã nguồn trong repository của một ứng viên. " +
	"Chỉ kết luận dựa trên các tệp được cung cấp, không suy đoán phần mã chưa đọc. " +
	"Trả về JSON thuần, không markdown, không giải thích ngoài JSON."

// BuildPrompt numbers every line so the model can point at a real location.
func BuildPrompt(in Input) string {
	var b strings.Builder
	b.WriteString("Đánh giá repository sau và nêu các phát hiện đáng chú ý về chất lượng mã.\n\n")
	b.WriteString("Repository: " + strings.TrimSpace(in.RepositoryURL) + "\n")
	if description := strings.TrimSpace(in.Description); description != "" {
		b.WriteString("Mô tả: " + truncate(description, 300) + "\n")
	}
	if languages := strings.TrimSpace(in.Languages); languages != "" {
		b.WriteString("Ngôn ngữ: " + languages + "\n")
	}
	if in.Summary != nil {
		b.WriteString(fmt.Sprintf("Quy mô: %d tệp, %d thư mục, %d tệp kiểm thử.\n",
			in.Summary.Files, in.Summary.Folders, in.Summary.Tests))
		if len(in.Summary.Modules) > 0 {
			parts := make([]string, 0, len(in.Summary.Modules))
			for _, module := range in.Summary.Modules {
				parts = append(parts, fmt.Sprintf("%s (%d tệp)", module.Name, module.Files))
			}
			b.WriteString("Thư mục lớn: " + strings.Join(parts, ", ") + "\n")
		}
	}
	if readme := strings.TrimSpace(in.Readme); readme != "" {
		b.WriteString("\nTrích README:\n" + truncate(readme, 1200) + "\n")
	}

	b.WriteString("\nCác tệp đã đọc (số ở đầu dòng là số dòng thật trong tệp):\n")
	for _, file := range in.Files {
		b.WriteString("\n--- FILE: " + file.Path + " ---\n")
		b.WriteString(numberedLines(file.Content))
	}

	b.WriteString(`
Yêu cầu:
- Chỉ nêu vấn đề thực sự nhìn thấy trong các tệp trên; không bịa tệp, không bịa dòng.
- "file" phải trùng đúng một đường dẫn ở trên; "line" là số dòng thật đã đánh số.
- "severity" chỉ nhận: high (bảo mật, mất dữ liệu, crash), medium (logic sai, thiếu xử lý lỗi), low (khó bảo trì, hiệu năng nhỏ), info (ghi chú trung tính).
- "title" tiếng Việt, tối đa 80 ký tự. "rationale" 1-3 câu giải thích vì sao là vấn đề. "verification" 1-2 câu cách kiểm chứng.
- "module" là thư mục hoặc tầng liên quan, tối đa 40 ký tự.
- Tối đa 6 phát hiện, ưu tiên mức nghiêm trọng cao và trải đều theo tệp. Không trả "code", hệ thống tự trích.
- Nếu không thấy vấn đề đáng kể, trả {"findings": []}.

Trả đúng định dạng:
{"findings":[{"severity":"high","title":"...","module":"...","file":"...","line":12,"rationale":"...","verification":"..."}]}
`)
	return b.String()
}

func numberedLines(content string) string {
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	limit := len(lines)
	if limit > maxFileLines {
		limit = maxFileLines
	}
	var b strings.Builder
	for index := 0; index < limit; index++ {
		b.WriteString(fmt.Sprintf("%4d| %s\n", index+1, lines[index]))
	}
	if limit < len(lines) {
		b.WriteString("... (tệp còn dài, đã cắt bớt)\n")
	}
	return b.String()
}

// GeminiSchema is the responseSchema for generateContent.
func GeminiSchema() map[string]any {
	return findingSchema(false)
}

// StrictSchema matches OpenAI's strict json_schema requirements.
func StrictSchema() map[string]any {
	return findingSchema(true)
}

func findingSchema(strict bool) map[string]any {
	finding := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"severity":     map[string]any{"type": "string", "enum": []string{"high", "medium", "low", "info"}},
			"title":        map[string]any{"type": "string"},
			"module":       map[string]any{"type": "string"},
			"file":         map[string]any{"type": "string"},
			"line":         map[string]any{"type": "integer"},
			"rationale":    map[string]any{"type": "string"},
			"verification": map[string]any{"type": "string"},
		},
		"required": []string{"severity", "title", "module", "file", "line", "rationale", "verification"},
	}
	if strict {
		finding["additionalProperties"] = false
	}
	schema := map[string]any{
		"type": "object",
		"properties": map[string]any{
			"findings": map[string]any{"type": "array", "items": finding},
		},
		"required": []string{"findings"},
	}
	if strict {
		schema["additionalProperties"] = false
	}
	return schema
}

type rawFinding struct {
	Severity     string `json:"severity"`
	Title        string `json:"title"`
	Module       string `json:"module"`
	File         string `json:"file"`
	Line         int    `json:"line"`
	Rationale    string `json:"rationale"`
	Verification string `json:"verification"`
}

// Decode validates the model answer against the files that were actually
// read, computes the code window around each line and drops anything that
// does not point at real content.
func Decode(raw string, files []File) ([]model.Finding, error) {
	body := extractJSON(raw)
	var payload struct {
		Findings []rawFinding `json:"findings"`
	}
	if err := json.Unmarshal([]byte(body), &payload); err != nil {
		return nil, fmt.Errorf("reporeview: invalid findings json: %w", err)
	}

	contents := make(map[string]string, len(files))
	for _, file := range files {
		contents[normalizePath(file.Path)] = strings.ReplaceAll(file.Content, "\r\n", "\n")
	}

	findings := make([]model.Finding, 0, len(payload.Findings))
	seen := map[string]struct{}{}
	for _, raw := range payload.Findings {
		filePath := matchFile(contents, raw.File)
		if filePath == "" {
			continue
		}
		lines := strings.Split(contents[filePath], "\n")
		if raw.Line < 1 || raw.Line > len(lines) {
			continue
		}
		title := truncate(strings.TrimSpace(raw.Title), 120)
		if title == "" {
			continue
		}
		key := fmt.Sprintf("%s:%d", filePath, raw.Line)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}

		code, hitLine := window(lines, raw.Line)
		module := truncate(strings.TrimSpace(raw.Module), 40)
		if module == "" {
			module = topModule(filePath)
		}
		findings = append(findings, model.Finding{
			Severity:     normalizeSeverity(raw.Severity),
			Title:        title,
			Module:       module,
			File:         filePath,
			Line:         raw.Line,
			State:        "open",
			Rationale:    truncate(strings.TrimSpace(raw.Rationale), 600),
			Verification: truncate(strings.TrimSpace(raw.Verification), 400),
			Code:         code,
			HitLine:      hitLine,
		})
		if len(findings) >= maxFindings {
			break
		}
	}
	return findings, nil
}

// matchFile finds the sampled path the model meant, tolerating a leading
// "./" or different casing.
func matchFile(contents map[string]string, raw string) string {
	candidate := normalizePath(raw)
	if _, ok := contents[candidate]; ok {
		return candidate
	}
	for filePath := range contents {
		if strings.EqualFold(filePath, candidate) {
			return filePath
		}
	}
	return ""
}

func normalizePath(raw string) string {
	trimmed := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(raw), "./"))
	return strings.TrimPrefix(trimmed, "/")
}

func normalizeSeverity(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "high", "critical", "blocker":
		return "high"
	case "medium", "moderate", "warning":
		return "medium"
	case "low", "minor":
		return "low"
	default:
		return "info"
	}
}

func window(lines []string, line int) (string, int) {
	start := line - windowRadius
	if start < 1 {
		start = 1
	}
	end := start + 2*windowRadius
	if end > len(lines) {
		end = len(lines)
	}
	if end-start < 2*windowRadius && start > 1 {
		start = end - 2*windowRadius
		if start < 1 {
			start = 1
		}
	}
	return strings.Join(lines[start-1:end], "\n"), line - start + 1
}

func truncate(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit]) + "…"
}

// extractJSON unwraps a ```json fence or surrounding prose, if any.
func extractJSON(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if strings.HasPrefix(trimmed, "```") {
		trimmed = strings.TrimPrefix(trimmed, "```")
		trimmed = strings.TrimPrefix(trimmed, "json")
		if index := strings.LastIndex(trimmed, "```"); index >= 0 {
			trimmed = trimmed[:index]
		}
	}
	start := strings.Index(trimmed, "{")
	end := strings.LastIndex(trimmed, "}")
	if start >= 0 && end > start {
		return trimmed[start : end+1]
	}
	return trimmed
}
