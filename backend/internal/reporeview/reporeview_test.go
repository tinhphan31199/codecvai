package reporeview

import (
	"strings"
	"testing"

	"codecv/backend/internal/model"
)

func TestPlanSkipsVendoredAndPrefersEntrypoints(t *testing.T) {
	tree := []model.RepoTreeNode{
		{Name: "node_modules", Type: "folder", Children: []model.RepoTreeNode{
			{Name: "lib.js", Type: "file", Size: 500},
		}},
		{Name: "cmd", Type: "folder", Children: []model.RepoTreeNode{
			{Name: "api", Type: "folder", Children: []model.RepoTreeNode{
				{Name: "main.go", Type: "file", Size: 900},
			}},
		}},
		{Name: "internal", Type: "folder", Children: []model.RepoTreeNode{
			{Name: "service.go", Type: "file", Size: 1200},
			{Name: "service_test.go", Type: "file", Size: 1200},
		}},
		{Name: "README.md", Type: "file", Size: 400},
	}
	summary := &model.RepoSummary{Entrypoints: []string{"cmd/api/main.go"}}

	paths := Plan(tree, summary, 2)
	if len(paths) != 2 {
		t.Fatalf("paths = %v, want two files", paths)
	}
	if paths[0] != "cmd/api/main.go" {
		t.Fatalf("paths[0] = %q, want the entrypoint first", paths[0])
	}
	for _, path := range paths {
		if strings.Contains(path, "node_modules") {
			t.Fatalf("paths = %v, vendored files must be skipped", paths)
		}
	}
}

func TestPlanIncludesTestsOnlyWhenNeeded(t *testing.T) {
	tree := []model.RepoTreeNode{
		{Name: "app.py", Type: "file", Size: 800},
		{Name: "tests", Type: "folder", Children: []model.RepoTreeNode{
			{Name: "test_app.py", Type: "file", Size: 600},
		}},
	}
	paths := Plan(tree, nil, 3)
	if len(paths) != 2 {
		t.Fatalf("paths = %v, want both files", paths)
	}
	if paths[0] != "app.py" {
		t.Fatalf("paths[0] = %q, want production file first", paths[0])
	}
}

func TestDecodeValidatesPathsLinesAndBuildsWindow(t *testing.T) {
	files := []File{
		{Path: "internal/service.go", Content: strings.Join([]string{
			"package service", "", "func Run() {", "\twork()", "\twork()", "\twork()",
			"\twork()", "\twork()", "\twork()", "\twork()", "}", "", "// end",
		}, "\n")},
	}
	raw := "```json\n" + `{"findings":[
		{"severity":"critical","title":"Bỏ qua lỗi","module":"service","file":"./internal/service.go","line":4,"rationale":"Vì sao","verification":"Kiểm tra"},
		{"severity":"medium","title":"Tệp không đọc","module":"","file":"cmd/main.go","line":4,"rationale":"x","verification":"y"},
		{"severity":"low","title":"Dòng ngoài phạm vi","module":"service","file":"internal/service.go","line":99,"rationale":"x","verification":"y"},
		{"severity":"low","title":"Trùng dòng","module":"service","file":"internal/service.go","line":4,"rationale":"x","verification":"y"}
	]}` + "\n```"

	findings, err := Decode(raw, files)
	if err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("findings = %d, want one valid finding", len(findings))
	}
	finding := findings[0]
	if finding.Severity != "high" {
		t.Fatalf("severity = %q, want critical normalized to high", finding.Severity)
	}
	if finding.File != "internal/service.go" || finding.Line != 4 {
		t.Fatalf("file/line = %s:%d", finding.File, finding.Line)
	}
	if finding.State != "open" {
		t.Fatalf("state = %q, want open", finding.State)
	}
	if finding.HitLine != 4 {
		t.Fatalf("hitLine = %d, want 4 inside a window starting at line 1", finding.HitLine)
	}
	if !strings.Contains(finding.Code, "\twork()") {
		t.Fatalf("code = %q, want the real file window", finding.Code)
	}
}

func TestDecodeAcceptsEmptyFindings(t *testing.T) {
	findings, err := Decode(`{"findings":[]}`, nil)
	if err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if len(findings) != 0 {
		t.Fatalf("findings = %d, want none", len(findings))
	}
}

func TestBuildPromptNumbersLines(t *testing.T) {
	prompt := BuildPrompt(Input{
		RepositoryURL: "https://github.com/octo/demo",
		Files: []File{
			{Path: "main.go", Content: "package main\nfunc main() {}\n"},
		},
	})
	if !strings.Contains(prompt, "--- FILE: main.go ---") {
		t.Fatal("prompt is missing the file header")
	}
	if !strings.Contains(prompt, "   1| package main") || !strings.Contains(prompt, "   2| func main() {}") {
		t.Fatalf("prompt lines are not numbered:\n%s", prompt)
	}
}
