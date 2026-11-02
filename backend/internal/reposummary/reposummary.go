// Package reposummary derives a structural synthesis of a scanned repository
// from its stored tree. It never reads file contents, so the scan can persist
// the summary in the same pass that stores the tree.
package reposummary

import (
	"path"
	"sort"
	"strings"

	"codecv/backend/internal/model"
)

const (
	maxModules     = 8
	maxFileTypes   = 8
	maxKeyFiles    = 12
	maxEntrypoints = 6
)

var flagOrder = []string{
	"manifest", "tests", "docker", "ci", "docs", "license", "migrations", "env",
}

var manifestFiles = map[string]struct{}{
	"go.mod": {}, "go.work": {}, "package.json": {}, "pnpm-workspace.yaml": {},
	"requirements.txt": {}, "pyproject.toml": {}, "pipfile": {}, "setup.py": {},
	"setup.cfg": {}, "cargo.toml": {}, "pom.xml": {}, "build.gradle": {},
	"build.gradle.kts": {}, "settings.gradle": {}, "settings.gradle.kts": {},
	"composer.json": {}, "gemfile": {}, "pubspec.yaml": {}, "mix.exs": {},
	"cmakelists.txt": {}, "makefile": {}, "justfile": {},
}

var configNames = map[string]struct{}{
	"tsconfig.json": {}, "angular.json": {}, ".editorconfig": {},
	".env.example": {}, ".env.sample": {}, ".env.template": {}, ".env.dist": {},
	".dockerignore": {}, ".gitattributes": {},
}

var configPrefixes = []string{
	"next.config.", "vite.config.", "webpack.config.", "eslint.config.",
	".eslintrc", ".prettierrc", "tailwind.config.", "postcss.config.",
	"jest.config.", "vitest.config.", "playwright.config.", "nuxt.config.",
	"svelte.config.", "babel.config.", "rollup.config.", "tsup.config.",
}

type stats struct {
	files    int
	folders  int
	bytes    int64
	tests    int
	modules  map[string]int
	exts     map[string]int
	keyFiles []model.RepoKeyFile
	entries  []string
	flags    map[string]bool
}

func newStats() *stats {
	return &stats{
		modules: map[string]int{},
		exts:    map[string]int{},
		flags:   map[string]bool{},
	}
}

// Build summarises one stored repository tree; an empty tree yields nil.
func Build(tree []model.RepoTreeNode) *model.RepoSummary {
	if len(tree) == 0 {
		return nil
	}
	s := newStats()
	walk(tree, "", s)
	if s.files == 0 {
		return nil
	}
	if s.tests > 0 {
		s.flags["tests"] = true
	}
	return &model.RepoSummary{
		Files:       s.files,
		Folders:     s.folders,
		SizeKB:      (s.bytes + 1023) / 1024,
		Tests:       s.tests,
		Flags:       orderedFlags(s.flags),
		Modules:     topModules(s.modules),
		FileTypes:   topFileTypes(s.exts),
		KeyFiles:    sortedKeyFiles(s.keyFiles),
		Entrypoints: sortedEntrypoints(s.entries),
	}
}

func walk(nodes []model.RepoTreeNode, prefix string, s *stats) {
	for _, node := range nodes {
		full := node.Name
		if prefix != "" {
			full = prefix + "/" + node.Name
		}
		switch node.Type {
		case "folder":
			s.folders++
			walk(node.Children, full, s)
			continue
		case "file":
		default:
			continue
		}

		s.files++
		s.bytes += node.Size
		base := strings.ToLower(node.Name)
		lowerPath := strings.ToLower(full)
		s.exts[fileExt(base)]++
		if isTestFile(base, lowerPath) {
			s.tests++
		}
		if module, _, nested := strings.Cut(lowerPath, "/"); nested {
			s.modules[module]++
		}
		if kind := classifyKeyFile(base, lowerPath); kind != "" {
			s.keyFiles = append(s.keyFiles, model.RepoKeyFile{Path: full, Kind: kind})
			switch kind {
			case "container":
				s.flags["docker"] = true
			case "ci":
				s.flags["ci"] = true
			case "license":
				s.flags["license"] = true
			case "manifest":
				s.flags["manifest"] = true
			case "docs":
				s.flags["docs"] = true
			}
		}
		if strings.HasPrefix(lowerPath, "docs/") {
			s.flags["docs"] = true
		}
		if isMigrationPath(lowerPath) {
			s.flags["migrations"] = true
		}
		if isEnvFile(base) {
			s.flags["env"] = true
		}
		if isEntrypoint(lowerPath) {
			s.entries = append(s.entries, full)
		}
	}
}

func fileExt(base string) string {
	ext := path.Ext(base)
	if ext == "" || ext == base {
		return base
	}
	return ext
}

func isTestFile(base, lowerPath string) bool {
	switch {
	case strings.HasSuffix(base, "_test.go"),
		strings.HasSuffix(base, "_test.py"),
		strings.HasSuffix(base, "_test.rb"),
		strings.HasSuffix(base, "_spec.rb"):
		return true
	case strings.HasPrefix(base, "test_") && strings.HasSuffix(base, ".py"):
		return true
	case strings.Contains(base, ".test."), strings.Contains(base, ".spec."):
		return true
	case strings.HasSuffix(base, "test.java"), strings.HasSuffix(base, "tests.java"),
		strings.HasSuffix(base, "test.cs"), strings.HasSuffix(base, "tests.cs"),
		strings.HasSuffix(base, "test.kt"), strings.HasSuffix(base, "tests.kt"):
		return true
	}
	for _, dir := range []string{"test/", "tests/", "__tests__/", "spec/"} {
		if strings.HasPrefix(lowerPath, dir) || strings.Contains(lowerPath, "/"+dir) {
			return true
		}
	}
	return false
}

func classifyKeyFile(base, lowerPath string) string {
	switch {
	case isContainerFile(base):
		return "container"
	case isCIFile(base, lowerPath):
		return "ci"
	case strings.HasPrefix(base, "license"), strings.HasPrefix(base, "copying"):
		return "license"
	case base == "readme.md", base == "readme", base == "readme.rst", base == "readme.txt":
		return "docs"
	}
	if _, ok := manifestFiles[base]; ok {
		return "manifest"
	}
	if isConfigFile(base) {
		return "config"
	}
	if isEntrypoint(lowerPath) {
		return "entry"
	}
	return ""
}

func isContainerFile(base string) bool {
	if strings.HasPrefix(base, "dockerfile") || base == "containerfile" {
		return true
	}
	switch base {
	case "docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml":
		return true
	}
	return false
}

func isCIFile(base, lowerPath string) bool {
	if strings.HasPrefix(lowerPath, ".github/workflows/") {
		return true
	}
	switch base {
	case "jenkinsfile", ".gitlab-ci.yml", "azure-pipelines.yml", ".travis.yml",
		"bitbucket-pipelines.yml", "cloudbuild.yaml", "appveyor.yml":
		return true
	}
	return false
}

func isConfigFile(base string) bool {
	if _, ok := configNames[base]; ok {
		return true
	}
	for _, prefix := range configPrefixes {
		if strings.HasPrefix(base, prefix) {
			return true
		}
	}
	return false
}

func isMigrationPath(lowerPath string) bool {
	return strings.HasPrefix(lowerPath, "migrations/") ||
		strings.Contains(lowerPath, "/migrations/") ||
		strings.HasPrefix(lowerPath, "prisma/migrations/") ||
		lowerPath == "prisma/schema.prisma" ||
		lowerPath == "alembic.ini"
}

func isEnvFile(base string) bool {
	switch base {
	case ".env.example", ".env.sample", ".env.template", ".env.dist", "env.example":
		return true
	}
	return false
}

func isEntrypoint(lowerPath string) bool {
	switch lowerPath {
	case "main.go", "main.py", "app.py", "manage.py", "main.rs", "program.cs",
		"main.dart", "server.js", "server.ts", "index.js", "index.ts", "app.js", "app.ts":
		return true
	case "src/main.ts", "src/main.tsx", "src/main.js", "src/main.jsx",
		"src/index.ts", "src/index.tsx", "src/index.js", "src/index.jsx",
		"src/server.ts", "src/server.js",
		"src/app/page.tsx", "src/app/page.jsx", "app/page.tsx", "app/page.jsx",
		"pages/index.tsx", "pages/index.jsx":
		return true
	}
	if strings.HasPrefix(lowerPath, "cmd/") && strings.HasSuffix(lowerPath, "/main.go") {
		return true
	}
	return false
}

func orderedFlags(flags map[string]bool) []string {
	ordered := make([]string, 0, len(flags))
	for _, flag := range flagOrder {
		if flags[flag] {
			ordered = append(ordered, flag)
		}
	}
	return ordered
}

func topModules(counts map[string]int) []model.RepoModule {
	modules := make([]model.RepoModule, 0, len(counts))
	for name, files := range counts {
		modules = append(modules, model.RepoModule{Name: name, Files: files})
	}
	sort.Slice(modules, func(i, j int) bool {
		if modules[i].Files != modules[j].Files {
			return modules[i].Files > modules[j].Files
		}
		return modules[i].Name < modules[j].Name
	})
	if len(modules) > maxModules {
		modules = modules[:maxModules]
	}
	return modules
}

func topFileTypes(counts map[string]int) []model.RepoFileType {
	types := make([]model.RepoFileType, 0, len(counts))
	for ext, count := range counts {
		types = append(types, model.RepoFileType{Ext: ext, Count: count})
	}
	sort.Slice(types, func(i, j int) bool {
		if types[i].Count != types[j].Count {
			return types[i].Count > types[j].Count
		}
		return types[i].Ext < types[j].Ext
	})
	if len(types) > maxFileTypes {
		types = types[:maxFileTypes]
	}
	return types
}

var keyKindOrder = map[string]int{
	"manifest": 0, "container": 1, "ci": 2, "docs": 3, "license": 4, "config": 5, "entry": 6,
}

func sortedKeyFiles(files []model.RepoKeyFile) []model.RepoKeyFile {
	sort.SliceStable(files, func(i, j int) bool {
		left, right := keyKindOrder[files[i].Kind], keyKindOrder[files[j].Kind]
		if left != right {
			return left < right
		}
		return files[i].Path < files[j].Path
	})
	if len(files) > maxKeyFiles {
		files = files[:maxKeyFiles]
	}
	return files
}

func sortedEntrypoints(entries []string) []string {
	seen := make(map[string]struct{}, len(entries))
	unique := make([]string, 0, len(entries))
	for _, entry := range entries {
		if _, exists := seen[entry]; exists {
			continue
		}
		seen[entry] = struct{}{}
		unique = append(unique, entry)
	}
	sort.SliceStable(unique, func(i, j int) bool {
		left, right := strings.Count(unique[i], "/"), strings.Count(unique[j], "/")
		if left != right {
			return left < right
		}
		return unique[i] < unique[j]
	})
	if len(unique) > maxEntrypoints {
		unique = unique[:maxEntrypoints]
	}
	return unique
}
