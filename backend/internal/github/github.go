package github

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"codecv/backend/internal/links"
	"codecv/backend/internal/model"
	"codecv/backend/internal/reposummary"
)

const (
	requestTimeout    = 7 * time.Second
	totalBudget       = 20 * time.Second
	maxContextChars   = 24_000
	maxReadmeChars    = 3_000
	maxReadmePreview  = 1_200
	maxProfileReadmes = 3
	maxProfileListed  = 24
	maxProfilePages   = 3
	maxQueueRepos     = 20
	maxRootEntries    = 40
	maxCommits        = 6
	maxTreeNodes      = 800
	maxTreeDepth      = 10
	maxPreviewChars   = 40_000
	perPage           = 100
	maxResponseBytes  = 4 << 20

	apiVersion   = "2022-11-28"
	jsonAccept   = "application/vnd.github+json"
	readmeAccept = "application/vnd.github.raw+json"
)

var (
	errNotFound    = errors.New("not_found")
	errRateLimited = errors.New("rate_limited")
	errTimeout     = errors.New("timeout")
	errNetwork     = errors.New("network")
)

// FileError reports why a repository file could not be read; Code is one of
// not_found, binary, rate_limited, timeout or network.
type FileError struct {
	Code string
}

func (e *FileError) Error() string { return "github file: " + e.Code }

// ignoredTreeDirs keeps generated dependency folders out of the stored tree.
var ignoredTreeDirs = map[string]struct{}{
	".git": {}, "node_modules": {}, "vendor": {}, "dist": {}, "build": {},
	".next": {}, ".nuxt": {}, "out": {}, "coverage": {}, "target": {},
	"__pycache__": {}, ".venv": {}, "venv": {}, ".idea": {}, ".vscode": {},
	"bower_components": {}, "pods": {}, "deriveddata": {}, ".cache": {}, ".turbo": {},
}

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func New(baseURL, token string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   strings.TrimSpace(token),
		http:    &http.Client{},
	}
}

type Evidence struct {
	Repositories []model.Repository
	// Discovered lists profile repositories saved for the background queue,
	// newest first, forks after original work, capped at maxQueueRepos.
	Discovered []model.RepositoryRecord
	Context    string
	Meta       model.GithubMeta
}

func (c *Client) Evidence(ctx context.Context, extraction links.Extraction) Evidence {
	repositories := make([]model.Repository, len(extraction.Repositories))
	copy(repositories, extraction.Repositories)

	indexByKey := make(map[string]int, len(repositories))
	for index, repository := range repositories {
		indexByKey[strings.ToLower(repository.Label)] = index
	}

	deadline := time.Now().Add(totalBudget)
	var contextBuilder strings.Builder
	publicRepos := 0
	discovered := make([]model.RepositoryRecord, 0, maxQueueRepos)
	seenDiscovered := make(map[string]struct{}, len(repositories)+maxQueueRepos)
	for _, repository := range repositories {
		seenDiscovered[strings.ToLower(repository.Label)] = struct{}{}
	}

	for _, target := range extraction.Targets {
		index, ok := indexByKey[target.Key]
		if !ok {
			continue
		}
		if !time.Now().Before(deadline) {
			repositories[index].Status = model.RepositoryUnavailable
			repositories[index].Detail = "Hết thời gian đọc dữ liệu GitHub"
			continue
		}

		if target.Kind == model.RepositoryRepo {
			updated, section := c.inspectRepo(ctx, deadline, target, repositories[index])
			repositories[index] = updated
			if section != "" {
				contextBuilder.WriteString(section)
				contextBuilder.WriteString("\n\n")
			}
			continue
		}

		updated, section, profileRepos, queued := c.inspectProfile(ctx, deadline, target, repositories[index])
		repositories[index] = updated
		publicRepos += profileRepos
		for _, repository := range queued {
			if len(discovered) >= maxQueueRepos {
				break
			}
			key := strings.ToLower(repository.Label)
			if _, exists := seenDiscovered[key]; exists {
				continue
			}
			seenDiscovered[key] = struct{}{}
			discovered = append(discovered, repository)
		}
		if section != "" {
			contextBuilder.WriteString(section)
			contextBuilder.WriteString("\n\n")
		}
	}

	analyzed := 0
	for _, repository := range repositories {
		if repository.Status != model.RepositoryAnalyzed {
			continue
		}
		if repository.Kind == model.RepositoryRepo || repository.Kind == model.RepositoryProfile {
			analyzed++
		}
	}

	return Evidence{
		Repositories: repositories,
		Discovered:   discovered,
		Context:      truncateRunes(strings.TrimSpace(contextBuilder.String()), maxContextChars),
		Meta: model.GithubMeta{
			Targets:     len(extraction.Targets),
			Analyzed:    analyzed,
			PublicRepos: publicRepos,
		},
	}
}

// Repo reads one repository outside the CV request so the background queue can
// spread GitHub calls over time instead of exhausting the rate limit mid-analysis.
func (c *Client) Repo(ctx context.Context, owner, name string) model.Repository {
	base := model.Repository{
		URL:    "https://github.com/" + owner + "/" + name,
		Label:  "github.com/" + strings.ToLower(owner) + "/" + strings.ToLower(name),
		Kind:   model.RepositoryRepo,
		Status: model.RepositoryUnavailable,
		Detail: "Chưa đọc dữ liệu GitHub",
	}
	target := links.Target{
		Key:   strings.ToLower(owner + "/" + name),
		Kind:  model.RepositoryRepo,
		URL:   base.URL,
		Owner: owner,
		Repo:  name,
	}
	deadline := time.Now().Add(totalBudget)
	repository, _ := c.inspectRepo(ctx, deadline, target, base)
	return repository
}

// File reads one blob stored in the repository tree, keeping the preview
// bounded so a large file cannot flood the API response.
func (c *Client) File(ctx context.Context, owner, name, sha string) (string, bool, error) {
	if strings.TrimSpace(owner) == "" || strings.TrimSpace(name) == "" || strings.TrimSpace(sha) == "" {
		return "", false, &FileError{Code: "not_found"}
	}
	deadline := time.Now().Add(2 * requestTimeout)
	path := "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(name) +
		"/git/blobs/" + url.PathEscape(sha)
	body, err := c.get(ctx, deadline, path, readmeAccept)
	if err != nil {
		return "", false, &FileError{Code: fileErrorCode(err)}
	}
	if bytes.IndexByte(body, 0) >= 0 || !utf8.Valid(body) {
		return "", false, &FileError{Code: "binary"}
	}
	text := string(body)
	truncated := false
	if utf8.RuneCountInString(text) > maxPreviewChars {
		text = truncateRunes(text, maxPreviewChars)
		truncated = true
	}
	return text, truncated, nil
}

func fileErrorCode(err error) string {
	switch {
	case errors.Is(err, errNotFound):
		return "not_found"
	case errors.Is(err, errRateLimited):
		return "rate_limited"
	case errors.Is(err, errTimeout):
		return "timeout"
	default:
		return "network"
	}
}

type githubRepo struct {
	Name          string   `json:"name"`
	FullName      string   `json:"full_name"`
	Description   string   `json:"description"`
	Language      string   `json:"language"`
	Stars         int      `json:"stargazers_count"`
	Forks         int      `json:"forks_count"`
	Subscribers   int      `json:"subscribers_count"`
	OpenIssues    int      `json:"open_issues_count"`
	Size          int      `json:"size"`
	Topics        []string `json:"topics"`
	PushedAt      string   `json:"pushed_at"`
	CreatedAt     string   `json:"created_at"`
	Archived      bool     `json:"archived"`
	Fork          bool     `json:"fork"`
	Homepage      string   `json:"homepage"`
	DefaultBranch string   `json:"default_branch"`
	License       struct {
		Name string `json:"name"`
	} `json:"license"`
}

type githubUser struct {
	Login       string `json:"login"`
	Name        string `json:"name"`
	Bio         string `json:"bio"`
	Company     string `json:"company"`
	Location    string `json:"location"`
	Blog        string `json:"blog"`
	PublicRepos int    `json:"public_repos"`
	Followers   int    `json:"followers"`
	CreatedAt   string `json:"created_at"`
}

type githubCommit struct {
	SHA    string `json:"sha"`
	Commit struct {
		Message string `json:"message"`
		Author  struct {
			Date string `json:"date"`
		} `json:"author"`
	} `json:"commit"`
}

type githubContent struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type githubTreeEntry struct {
	Path string `json:"path"`
	Type string `json:"type"`
	SHA  string `json:"sha"`
	Size int64  `json:"size"`
}

type githubTreeResponse struct {
	Tree      []githubTreeEntry `json:"tree"`
	Truncated bool              `json:"truncated"`
}

func (c *Client) inspectRepo(
	ctx context.Context,
	deadline time.Time,
	target links.Target,
	base model.Repository,
) (model.Repository, string) {
	repoPath := "/repos/" + url.PathEscape(target.Owner) + "/" + url.PathEscape(target.Repo)

	body, err := c.get(ctx, deadline, repoPath, jsonAccept)
	if err != nil {
		base.Status = model.RepositoryUnavailable
		base.Detail = failureDetail(err, "repo")
		return base, ""
	}

	var repo githubRepo
	if err := json.Unmarshal(body, &repo); err != nil {
		base.Status = model.RepositoryUnavailable
		base.Detail = "Không đọc được dữ liệu repo"
		return base, ""
	}

	var (
		wg        sync.WaitGroup
		languages map[string]float64
		readme    string
		contents  []githubContent
		commits   []githubCommit
		treeData  githubTreeResponse
	)

	wg.Add(5)
	go func() {
		defer wg.Done()
		data, err := c.get(ctx, deadline, repoPath+"/languages", jsonAccept)
		if err != nil {
			return
		}
		_ = json.Unmarshal(data, &languages)
	}()
	go func() {
		defer wg.Done()
		data, err := c.get(ctx, deadline, repoPath+"/readme", readmeAccept)
		if err != nil {
			return
		}
		readme = string(data)
	}()
	go func() {
		defer wg.Done()
		data, err := c.get(ctx, deadline, repoPath+"/contents", jsonAccept)
		if err != nil {
			return
		}
		var parsed []githubContent
		if json.Unmarshal(data, &parsed) == nil {
			contents = parsed
		}
	}()
	go func() {
		defer wg.Done()
		data, err := c.get(
			ctx,
			deadline,
			repoPath+"/commits?per_page="+strconv.Itoa(maxCommits),
			jsonAccept,
		)
		if err != nil {
			return
		}
		var parsed []githubCommit
		if json.Unmarshal(data, &parsed) == nil {
			commits = parsed
		}
	}()
	go func() {
		defer wg.Done()
		branch := defaultIfEmpty(repo.DefaultBranch, "HEAD")
		data, err := c.get(
			ctx,
			deadline,
			repoPath+"/git/trees/"+url.PathEscape(branch)+"?recursive=1",
			jsonAccept,
		)
		if err != nil {
			return
		}
		_ = json.Unmarshal(data, &treeData)
	}()
	wg.Wait()

	section := repoSection(target, repo, languages, readme, contents, commits)

	summary := []string{
		defaultIfEmpty(oneLine(repo.Language, 40), "Chưa rõ ngôn ngữ"),
		fmt.Sprintf("%d★", repo.Stars),
	}
	if description := oneLine(repo.Description, 120); description != "" {
		summary = append(summary, description)
	}

	readmeChars := utf8.RuneCountInString(clip(readme, maxReadmeChars))
	readmeDetail := "không có README"
	if readmeChars > 0 {
		readmeDetail = fmt.Sprintf("README %.1fk ký tự", float64(readmeChars)/1000)
	}
	commitDetail := "chưa lấy được commit"
	if commits != nil {
		commitDetail = fmt.Sprintf("%d commit gần nhất", len(commits))
	}

	base.Status = model.RepositoryAnalyzed
	base.Context = truncateRunes(strings.Join(summary, " · "), 160)
	base.Detail = "Đã đọc repo · " + commitDetail + " · " + readmeDetail
	tree, fileCount, treeTruncated := buildRepoTree(treeData)
	base.Tree = tree
	base.Details = buildDetails(target, repo, languages, readme, commits, fileCount, treeTruncated)
	base.Summary = reposummary.Build(base.Tree)
	return base, section
}

func (c *Client) inspectProfile(
	ctx context.Context,
	deadline time.Time,
	target links.Target,
	base model.Repository,
) (model.Repository, string, int, []model.RepositoryRecord) {
	login := url.PathEscape(target.Login)

	var (
		wg       sync.WaitGroup
		user     githubUser
		userErr  error
		repos    []githubRepo
		reposErr error
	)

	wg.Add(2)
	go func() {
		defer wg.Done()
		body, err := c.get(ctx, deadline, "/users/"+login, jsonAccept)
		if err != nil {
			userErr = err
			return
		}
		if err := json.Unmarshal(body, &user); err != nil {
			userErr = errNetwork
		}
	}()
	go func() {
		defer wg.Done()
		body, err := c.get(ctx, deadline, profileReposPath(login, 1), jsonAccept)
		if err != nil {
			reposErr = err
			return
		}
		if err := json.Unmarshal(body, &repos); err != nil {
			reposErr = errNetwork
		}
	}()
	wg.Wait()

	if userErr != nil {
		base.Status = model.RepositoryUnavailable
		base.Detail = failureDetail(userErr, "profile")
		return base, "", 0, nil
	}

	scanned := validRepos(repos)
	if reposErr == nil && len(repos) == perPage {
		for page := 2; page <= maxProfilePages; page++ {
			if time.Until(deadline) < 1500*time.Millisecond {
				break
			}
			body, err := c.get(ctx, deadline, profileReposPath(login, page), jsonAccept)
			if err != nil {
				break
			}
			var next []githubRepo
			if json.Unmarshal(body, &next) != nil || len(next) == 0 {
				break
			}
			scanned = append(scanned, validRepos(next)...)
			if len(next) < perPage {
				break
			}
		}
	}

	lines := []string{fmt.Sprintf(
		"=== GitHub profile: %s (%s) ===",
		defaultIfEmpty(user.Login, target.Login),
		target.URL,
	)}
	if name := oneLine(user.Name, 120); name != "" {
		lines = append(lines, "Tên hiển thị: "+name)
	}
	if bio := oneLine(user.Bio, 300); bio != "" {
		lines = append(lines, "Bio: "+bio)
	}
	meta := make([]string, 0, 3)
	for _, value := range []string{
		oneLine(user.Company, 120),
		oneLine(user.Location, 120),
		oneLine(user.Blog, 200),
	} {
		if value != "" {
			meta = append(meta, value)
		}
	}
	if len(meta) > 0 {
		lines = append(lines, "Thông tin: "+strings.Join(meta, " · "))
	}
	publicRepos := user.PublicRepos
	if publicRepos <= 0 {
		publicRepos = len(scanned)
	}
	lines = append(lines, fmt.Sprintf(
		"Repo công khai: %d · Followers: %d · Tham gia: %s",
		publicRepos,
		user.Followers,
		defaultIfEmpty(isoDate(user.CreatedAt), "không rõ"),
	))

	listed := scanned
	if len(listed) > maxProfileListed {
		listed = listed[:maxProfileListed]
	}
	if len(listed) > 0 {
		lines = append(lines, "Repo công khai (mới đẩy gần nhất):")
		for _, repo := range listed {
			description := oneLine(repo.Description, 160)
			suffix := ""
			if description != "" {
				suffix = " — " + description
			}
			flags := make([]string, 0, 2)
			if repo.Fork {
				flags = append(flags, "fork")
			}
			if repo.Archived {
				flags = append(flags, "archived")
			}
			flagText := ""
			if len(flags) > 0 {
				flagText = ", " + strings.Join(flags, ", ")
			}
			lines = append(lines, fmt.Sprintf(
				"- %s [%s] %d★%s (cập nhật %s%s)",
				clip(repo.Name, 100),
				defaultIfEmpty(oneLine(repo.Language, 30), "không rõ ngôn ngữ"),
				repo.Stars,
				suffix,
				defaultIfEmpty(isoDate(repo.PushedAt), "không rõ"),
				flagText,
			))
		}
		if len(scanned) > len(listed) {
			lines = append(lines, fmt.Sprintf("- … và %d repo khác", len(scanned)-len(listed)))
		}
	} else if reposErr == nil {
		lines = append(lines, "Không có repo công khai.")
	} else {
		lines = append(lines, "Không lấy được danh sách repo công khai.")
	}

	readmeTargets := make([]githubRepo, 0, maxProfileReadmes)
	for _, repo := range scanned {
		if repo.Fork {
			continue
		}
		readmeTargets = append(readmeTargets, repo)
		if len(readmeTargets) == maxProfileReadmes {
			break
		}
	}

	readmeSections := make([]string, len(readmeTargets))
	var readmeWG sync.WaitGroup
	readmeWG.Add(len(readmeTargets))
	for index, repo := range readmeTargets {
		go func(index int, repo githubRepo) {
			defer readmeWG.Done()
			name := clip(repo.Name, 100)
			body, err := c.get(
				ctx,
				deadline,
				"/repos/"+login+"/"+url.PathEscape(name)+"/readme",
				readmeAccept,
			)
			if err != nil {
				return
			}
			text := clip(string(body), maxReadmeChars)
			if text == "" {
				return
			}
			readmeSections[index] = "### README " + name + "\n\"\"\"\n" + text + "\n\"\"\""
		}(index, repo)
	}
	readmeWG.Wait()

	foundReadmes := 0
	collected := make([]string, 0, len(readmeSections))
	for _, section := range readmeSections {
		if section == "" {
			continue
		}
		foundReadmes++
		collected = append(collected, section)
	}
	if len(collected) > 0 {
		lines = append(lines, fmt.Sprintf("README của %d repo nổi bật:", len(collected)))
		lines = append(lines, collected...)
	}

	topLanguages := make([]string, 0, 3)
	seenLanguages := make(map[string]struct{}, 3)
	for _, repo := range scanned {
		language := oneLine(repo.Language, 30)
		if language == "" {
			continue
		}
		if _, seen := seenLanguages[language]; seen {
			continue
		}
		seenLanguages[language] = struct{}{}
		topLanguages = append(topLanguages, language)
		if len(topLanguages) == 3 {
			break
		}
	}

	summary := []string{fmt.Sprintf("%d repo công khai", publicRepos)}
	if len(topLanguages) > 0 {
		summary = append(summary, strings.Join(topLanguages, ", "))
	}

	detail := "Đã đọc hồ sơ · chưa lấy được danh sách repo"
	if reposErr == nil {
		detail = fmt.Sprintf("Đã quét %d repo công khai · %d README", len(scanned), foundReadmes)
	}

	base.Status = model.RepositoryAnalyzed
	base.Context = truncateRunes(strings.Join(summary, " · "), 160)
	base.Detail = detail

	return base, strings.Join(lines, "\n"), publicRepos, profileRepoQueue(defaultIfEmpty(user.Login, target.Login), scanned)
}

// profileRepoQueue turns the profile listing into pending rows for the
// background worker: original work first, forks only after it, at most 20.
func profileRepoQueue(login string, scanned []githubRepo) []model.RepositoryRecord {
	ordered := make([]githubRepo, 0, len(scanned))
	for _, repo := range scanned {
		if !repo.Fork {
			ordered = append(ordered, repo)
		}
	}
	for _, repo := range scanned {
		if repo.Fork {
			ordered = append(ordered, repo)
		}
	}

	seen := make(map[string]struct{}, maxQueueRepos)
	queued := make([]model.RepositoryRecord, 0, maxQueueRepos)
	for _, repo := range ordered {
		fullName := clip(repo.FullName, 140)
		if fullName == "" {
			fullName = login + "/" + repo.Name
		}
		owner, name, ok := strings.Cut(fullName, "/")
		if !ok || owner == "" || name == "" {
			continue
		}
		key := strings.ToLower(fullName)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		queued = append(queued, model.RepositoryRecord{
			URL:    "https://github.com/" + fullName,
			Label:  "github.com/" + key,
			Kind:   model.RepositoryRepo,
			Status: model.RepositoryPending,
			Detail: "Đang chờ phân tích ở luồng nền",
			Source: "profile",
			Owner:  owner,
			Name:   name,
		})
		if len(queued) == maxQueueRepos {
			break
		}
	}
	return queued
}

func (c *Client) get(ctx context.Context, deadline time.Time, path, accept string) ([]byte, error) {
	remaining := time.Until(deadline)
	if remaining < 500*time.Millisecond {
		return nil, errTimeout
	}
	if err := ctx.Err(); err != nil {
		return nil, errTimeout
	}

	requestCtx, cancel := context.WithTimeout(ctx, min(requestTimeout, remaining))
	defer cancel()

	request, err := http.NewRequestWithContext(requestCtx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return nil, errNetwork
	}
	request.Header.Set("Accept", accept)
	request.Header.Set("X-GitHub-Api-Version", apiVersion)
	request.Header.Set("User-Agent", "CodeCV-AI")
	if c.token != "" {
		request.Header.Set("Authorization", "Bearer "+c.token)
	}

	response, err := c.http.Do(request)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			return nil, errTimeout
		}
		return nil, errNetwork
	}
	defer response.Body.Close()

	if response.StatusCode >= 200 && response.StatusCode < 300 {
		body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
		if err != nil {
			return nil, errNetwork
		}
		return body, nil
	}

	switch response.StatusCode {
	case http.StatusNotFound:
		return nil, errNotFound
	case http.StatusForbidden, http.StatusTooManyRequests:
		return nil, errRateLimited
	default:
		return nil, errNetwork
	}
}

func repoSection(
	target links.Target,
	repo githubRepo,
	languages map[string]float64,
	readme string,
	contents []githubContent,
	commits []githubCommit,
) string {
	fullName := clip(repo.FullName, 120)
	if fullName == "" {
		fullName = target.Owner + "/" + target.Repo
	}

	lines := []string{fmt.Sprintf("=== GitHub repo: %s (%s) ===", fullName, target.URL)}
	if description := oneLine(repo.Description, 400); description != "" {
		lines = append(lines, "Mô tả: "+description)
	}
	if langs := defaultIfEmpty(languageSummary(languages), oneLine(repo.Language, 60)); langs != "" {
		lines = append(lines, "Ngôn ngữ: "+langs)
	}

	facts := []string{
		fmt.Sprintf("%d★", repo.Stars),
		fmt.Sprintf("%d fork", repo.Forks),
		"Cập nhật: " + defaultIfEmpty(isoDate(repo.PushedAt), "không rõ"),
	}
	if repo.DefaultBranch != "" {
		facts = append(facts, "Nhánh chính: "+repo.DefaultBranch)
	}
	if repo.Fork {
		facts = append(facts, "Là bản fork")
	}
	if repo.Archived {
		facts = append(facts, "Đã lưu trữ")
	}
	lines = append(lines, strings.Join(facts, " · "))

	if len(repo.Topics) > 0 {
		lines = append(lines, "Topics: "+strings.Join(repo.Topics[:min(12, len(repo.Topics))], ", "))
	}
	if homepage := clip(repo.Homepage, 200); homepage != "" {
		lines = append(lines, "Homepage: "+homepage)
	}
	if entries := rootEntries(contents); entries != "" {
		lines = append(lines, "Thư mục/tệp gốc: "+entries)
	}
	if commitText := commitLines(commits); len(commitText) > 0 {
		lines = append(lines, "Commit gần đây:")
		lines = append(lines, commitText...)
	}
	if readmeText := clip(readme, maxReadmeChars); readmeText != "" {
		lines = append(
			lines,
			fmt.Sprintf("README (rút gọn %d ký tự):", utf8.RuneCountInString(readmeText)),
			`"""`,
			readmeText,
			`"""`,
		)
	}

	return strings.Join(lines, "\n")
}

type treeBuildNode struct {
	name     string
	typ      string
	sha      string
	size     int64
	children []*treeBuildNode
	index    map[string]*treeBuildNode
}

// buildRepoTree turns the recursive GitHub tree into the nested shape the
// Repository screen renders, dropping dependency folders and capping the node
// count so one huge monorepo cannot bloat the stored JSON.
func buildRepoTree(payload githubTreeResponse) ([]model.RepoTreeNode, int, bool) {
	totalFiles := 0
	kept := make([]githubTreeEntry, 0, len(payload.Tree))
	for _, entry := range payload.Tree {
		path := strings.TrimSpace(entry.Path)
		if path == "" || (entry.Type != "blob" && entry.Type != "tree") {
			continue
		}
		if strings.Count(path, "/") >= maxTreeDepth || hasIgnoredTreeDir(path) {
			continue
		}
		kept = append(kept, entry)
		if entry.Type == "blob" {
			totalFiles++
		}
	}
	sort.Slice(kept, func(i, j int) bool { return kept[i].Path < kept[j].Path })

	root := &treeBuildNode{typ: "folder", index: map[string]*treeBuildNode{}}
	nodes := 0
	truncated := payload.Truncated
	for _, entry := range kept {
		parts := strings.Split(entry.Path, "/")
		parent := root
		for i, part := range parts {
			if child, ok := parent.index[part]; ok {
				parent = child
				continue
			}
			if nodes >= maxTreeNodes {
				truncated = true
				break
			}
			kind := "folder"
			if i == len(parts)-1 && entry.Type == "blob" {
				kind = "file"
			}
			child := &treeBuildNode{name: part, typ: kind, index: map[string]*treeBuildNode{}}
			if kind == "file" {
				child.sha = clip(entry.SHA, 64)
				child.size = entry.Size
			}
			parent.children = append(parent.children, child)
			parent.index[part] = child
			parent = child
			nodes++
		}
	}

	return treeNodes(root.children), totalFiles, truncated
}

func treeNodes(nodes []*treeBuildNode) []model.RepoTreeNode {
	sort.SliceStable(nodes, func(i, j int) bool {
		if nodes[i].typ != nodes[j].typ {
			return nodes[i].typ == "folder"
		}
		return strings.ToLower(nodes[i].name) < strings.ToLower(nodes[j].name)
	})
	tree := make([]model.RepoTreeNode, 0, len(nodes))
	for _, node := range nodes {
		tree = append(tree, model.RepoTreeNode{
			Name:     node.name,
			Type:     node.typ,
			SHA:      node.sha,
			Size:     node.size,
			Children: treeNodes(node.children),
		})
	}
	return tree
}

func hasIgnoredTreeDir(path string) bool {
	parts := strings.Split(path, "/")
	for _, part := range parts[:len(parts)-1] {
		if _, ignored := ignoredTreeDirs[strings.ToLower(part)]; ignored {
			return true
		}
	}
	return false
}

func buildDetails(
	target links.Target,
	repo githubRepo,
	languages map[string]float64,
	readme string,
	commits []githubCommit,
	fileCount int,
	treeTruncated bool,
) *model.RepoDetails {
	fullName := clip(repo.FullName, 140)
	if fullName == "" {
		fullName = target.Owner + "/" + target.Repo
	}
	readmeText := clip(readme, maxReadmeChars)
	preview := clip(readme, maxReadmePreview)

	topics := make([]string, 0, min(12, len(repo.Topics)))
	for _, topic := range repo.Topics[:min(12, len(repo.Topics))] {
		if value := oneLine(topic, 40); value != "" {
			topics = append(topics, value)
		}
	}

	details := &model.RepoDetails{
		FullName:      fullName,
		Description:   oneLine(repo.Description, 400),
		Language:      oneLine(repo.Language, 60),
		Languages:     languageDetails(languages),
		Topics:        topics,
		Stars:         repo.Stars,
		Forks:         repo.Forks,
		Watchers:      repo.Subscribers,
		OpenIssues:    repo.OpenIssues,
		SizeKB:        repo.Size,
		DefaultBranch: clip(repo.DefaultBranch, 120),
		PushedAt:      isoDate(repo.PushedAt),
		CreatedAt:     isoDate(repo.CreatedAt),
		Homepage:      clip(repo.Homepage, 200),
		License:       oneLine(repo.License.Name, 80),
		Fork:          repo.Fork,
		Archived:      repo.Archived,
		Readme:        preview,
		ReadmeChars:   utf8.RuneCountInString(readmeText),
		FileCount:     fileCount,
		TreeTruncated: treeTruncated,
		Commits:       make([]model.RepoCommit, 0, min(maxCommits, len(commits))),
	}
	for _, commit := range commits[:min(maxCommits, len(commits))] {
		details.Commits = append(details.Commits, model.RepoCommit{
			SHA:     clip(commit.SHA, 7),
			Message: oneLine(commit.Commit.Message, 140),
			Date:    isoDate(commit.Commit.Author.Date),
		})
	}
	return details
}

func languageDetails(languages map[string]float64) []model.RepoLanguage {
	type language struct {
		name  string
		bytes float64
	}
	list := make([]language, 0, len(languages))
	total := 0.0
	for name, size := range languages {
		if size <= 0 {
			continue
		}
		list = append(list, language{name: name, bytes: size})
		total += size
	}
	if total == 0 {
		return []model.RepoLanguage{}
	}
	sort.Slice(list, func(i, j int) bool { return list[i].bytes > list[j].bytes })

	details := make([]model.RepoLanguage, 0, len(list))
	for _, item := range list {
		details = append(details, model.RepoLanguage{
			Name:    item.name,
			Percent: math.Round(item.bytes/total*1000) / 10,
		})
	}
	return details
}

func languageSummary(languages map[string]float64) string {
	type language struct {
		name  string
		bytes float64
	}

	list := make([]language, 0, len(languages))
	for name, size := range languages {
		if size > 0 {
			list = append(list, language{name: name, bytes: size})
		}
	}
	if len(list) == 0 {
		return ""
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].bytes > list[j].bytes
	})

	total := 0.0
	for _, item := range list {
		total += item.bytes
	}

	parts := make([]string, 0, 5)
	for _, item := range list[:min(5, len(list))] {
		parts = append(parts, fmt.Sprintf("%s %.0f%%", item.name, item.bytes/total*100))
	}
	return strings.Join(parts, ", ")
}

func rootEntries(contents []githubContent) string {
	parts := make([]string, 0, min(maxRootEntries, len(contents)))
	for _, entry := range contents[:min(maxRootEntries, len(contents))] {
		name := clip(entry.Name, 80)
		if name == "" {
			continue
		}
		if entry.Type == "dir" {
			name += "/"
		}
		parts = append(parts, name)
	}
	return strings.Join(parts, ", ")
}

func commitLines(commits []githubCommit) []string {
	lines := make([]string, 0, min(maxCommits, len(commits)))
	for _, commit := range commits[:min(maxCommits, len(commits))] {
		message := oneLine(commit.Commit.Message, 120)
		if message == "" {
			continue
		}
		prefix := strings.TrimSpace(strings.Join(nonEmpty(
			isoDate(commit.Commit.Author.Date),
			clip(commit.SHA, 7),
		), " "))
		if prefix == "" {
			lines = append(lines, "- "+message)
			continue
		}
		lines = append(lines, "- "+prefix+": "+message)
	}
	return lines
}

func validRepos(repos []githubRepo) []githubRepo {
	valid := make([]githubRepo, 0, len(repos))
	for _, repo := range repos {
		if clip(repo.Name, 100) != "" {
			valid = append(valid, repo)
		}
	}
	return valid
}

func profileReposPath(login string, page int) string {
	return fmt.Sprintf(
		"/users/%s/repos?per_page=%d&sort=pushed&direction=desc&type=owner&page=%d",
		login,
		perPage,
		page,
	)
}

func failureDetail(err error, scope string) string {
	switch {
	case errors.Is(err, errNotFound):
		if scope == "repo" {
			return "Không tìm thấy repo công khai (có thể đã đổi tên hoặc để riêng tư)"
		}
		return "Không tìm thấy tài khoản GitHub công khai"
	case errors.Is(err, errRateLimited):
		return "GitHub giới hạn lượt gọi API, chưa đọc được dữ liệu"
	case errors.Is(err, errTimeout):
		return "Hết thời gian đọc dữ liệu GitHub"
	default:
		return "Không kết nối được GitHub API"
	}
}

func oneLine(value string, maxLength int) string {
	return clip(strings.Join(strings.Fields(value), " "), maxLength)
}

func clip(value string, maxLength int) string {
	trimmed := strings.TrimSpace(value)
	runes := []rune(trimmed)
	if len(runes) > maxLength {
		return string(runes[:maxLength])
	}
	return trimmed
}

func truncateRunes(value string, maxLength int) string {
	runes := []rune(value)
	if len(runes) <= maxLength {
		return value
	}
	return strings.TrimSpace(string(runes[:maxLength-1])) + "…"
}

func isoDate(value string) string {
	if len(value) >= 10 {
		return value[:10]
	}
	return value
}

func defaultIfEmpty(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func nonEmpty(values ...string) []string {
	kept := make([]string, 0, len(values))
	for _, value := range values {
		if value != "" {
			kept = append(kept, value)
		}
	}
	return kept
}
