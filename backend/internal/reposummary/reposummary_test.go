package reposummary

import (
	"reflect"
	"testing"

	"codecv/backend/internal/model"
)

func TestBuildSummarisesTree(t *testing.T) {
	tree := []model.RepoTreeNode{
		{Name: "cmd", Type: "folder", Children: []model.RepoTreeNode{
			{Name: "api", Type: "folder", Children: []model.RepoTreeNode{
				{Name: "main.go", Type: "file", Size: 2000},
			}},
		}},
		{Name: "internal", Type: "folder", Children: []model.RepoTreeNode{
			{Name: "store", Type: "folder", Children: []model.RepoTreeNode{
				{Name: "app.go", Type: "file", Size: 1000},
				{Name: "store_test.go", Type: "file", Size: 500},
			}},
		}},
		{Name: ".github", Type: "folder", Children: []model.RepoTreeNode{
			{Name: "workflows", Type: "folder", Children: []model.RepoTreeNode{
				{Name: "ci.yml", Type: "file", Size: 400},
			}},
		}},
		{Name: "go.mod", Type: "file", Size: 120},
		{Name: "Dockerfile", Type: "file", Size: 300},
		{Name: "README.md", Type: "file", Size: 1000},
	}

	summary := Build(tree)
	if summary == nil {
		t.Fatal("Build returned nil")
	}
	if summary.Files != 7 || summary.Folders != 6 {
		t.Fatalf("files/folders = %d/%d, want 7/6", summary.Files, summary.Folders)
	}
	if summary.SizeKB != 6 {
		t.Fatalf("size = %d KB, want 6", summary.SizeKB)
	}
	if summary.Tests != 1 {
		t.Fatalf("tests = %d, want 1", summary.Tests)
	}
	wantFlags := []string{"manifest", "tests", "docker", "ci", "docs"}
	if !reflect.DeepEqual(summary.Flags, wantFlags) {
		t.Fatalf("flags = %v, want %v", summary.Flags, wantFlags)
	}
	wantModules := []model.RepoModule{
		{Name: "internal", Files: 2},
		{Name: ".github", Files: 1},
		{Name: "cmd", Files: 1},
	}
	if !reflect.DeepEqual(summary.Modules, wantModules) {
		t.Fatalf("modules = %v, want %v", summary.Modules, wantModules)
	}
	wantKeyFiles := []model.RepoKeyFile{
		{Path: "go.mod", Kind: "manifest"},
		{Path: "Dockerfile", Kind: "container"},
		{Path: ".github/workflows/ci.yml", Kind: "ci"},
		{Path: "README.md", Kind: "docs"},
		{Path: "cmd/api/main.go", Kind: "entry"},
	}
	if !reflect.DeepEqual(summary.KeyFiles, wantKeyFiles) {
		t.Fatalf("key files = %v, want %v", summary.KeyFiles, wantKeyFiles)
	}
	if !reflect.DeepEqual(summary.Entrypoints, []string{"cmd/api/main.go"}) {
		t.Fatalf("entrypoints = %v, want cmd/api/main.go", summary.Entrypoints)
	}
	if summary.FileTypes[0] != (model.RepoFileType{Ext: ".go", Count: 3}) {
		t.Fatalf("top file type = %v, want .go x3", summary.FileTypes[0])
	}
}

func TestBuildFlagsEnvAndMigrations(t *testing.T) {
	tree := []model.RepoTreeNode{
		{Name: "main.go", Type: "file", Size: 64},
		{Name: ".env.example", Type: "file", Size: 32},
		{Name: "migrations", Type: "folder", Children: []model.RepoTreeNode{
			{Name: "0001_init.sql", Type: "file", Size: 128},
		}},
	}

	summary := Build(tree)
	if summary == nil {
		t.Fatal("Build returned nil")
	}
	wantFlags := []string{"migrations", "env"}
	if !reflect.DeepEqual(summary.Flags, wantFlags) {
		t.Fatalf("flags = %v, want %v", summary.Flags, wantFlags)
	}
	if !reflect.DeepEqual(summary.Entrypoints, []string{"main.go"}) {
		t.Fatalf("entrypoints = %v, want main.go", summary.Entrypoints)
	}
	if summary.Tests != 0 {
		t.Fatalf("tests = %d, want 0", summary.Tests)
	}
}

func TestBuildEmptyTree(t *testing.T) {
	if Build(nil) != nil {
		t.Fatal("Build(nil) should be nil")
	}
	if Build([]model.RepoTreeNode{{Name: "empty", Type: "folder"}}) != nil {
		t.Fatal("Build of a folder-only tree should be nil")
	}
}
