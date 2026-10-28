package links

import (
	"regexp"
	"strings"

	"codecv/backend/internal/model"
)

const (
	maxLinks         = 5
	maxGithubTargets = 3
)

type Target struct {
	Key   string
	Kind  string
	URL   string
	Owner string
	Repo  string
	Login string
}

type Extraction struct {
	Repositories []model.Repository
	Targets      []Target
}

var (
	repoLinkRe      = regexp.MustCompile(`(?i)(?:https?://)?(?:www\.)?(github\.com|gitlab\.com|bitbucket\.org)/([\w.-]+)/([\w.-]+)(?:[/?#][^\s<>"'()\[\]]*)?`)
	githubProfileRe = regexp.MustCompile(`(?i)(?:https?://)?(?:www\.)?github\.com/([\w.-]+)/?`)
	loginRe         = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$`)
	repoNameRe      = regexp.MustCompile(`^[A-Za-z0-9._-]{1,100}$`)
)

var reservedGithubPaths = map[string]struct{}{
	"about": {}, "account": {}, "apps": {}, "codespaces": {}, "collections": {},
	"contact": {}, "customer-stories": {}, "enterprise": {}, "events": {},
	"explore": {}, "features": {}, "issues": {}, "join": {}, "login": {},
	"logout": {}, "marketplace": {}, "mobile": {}, "new": {}, "notifications": {},
	"orgs": {}, "organizations": {}, "pricing": {}, "pulls": {}, "readme": {},
	"search": {}, "security": {}, "sessions": {}, "settings": {}, "site": {},
	"solutions": {}, "sponsors": {}, "team": {}, "topics": {}, "trending": {},
	"users": {}, "watching": {},
}

func Extract(cvText string) Extraction {
	result := Extraction{
		Repositories: make([]model.Repository, 0, maxLinks),
		Targets:      make([]Target, 0, maxGithubTargets),
	}
	seen := make(map[string]struct{})

	add := func(rawURL, host, owner, repo string) {
		if len(result.Repositories) >= maxLinks {
			return
		}

		hostLabel := strings.ToLower(host)
		hostLabel = strings.TrimPrefix(hostLabel, "www.")

		name := repo
		if strings.HasSuffix(strings.ToLower(name), ".git") {
			name = name[:len(name)-4]
		}

		canonical := strings.ToLower(hostLabel + "/" + owner)
		if name != "" {
			canonical += "/" + name
		}
		if _, exists := seen[canonical]; exists {
			return
		}
		seen[canonical] = struct{}{}

		label := hostLabel + "/" + owner
		if name != "" {
			label += "/" + name
		}

		url := withProtocol(cleanURL(rawURL))
		if name != "" && strings.HasSuffix(strings.ToLower(url), ".git") {
			url = url[:len(url)-4]
		}
		isGithub := hostLabel == "github.com"

		if isGithub && len(result.Targets) < maxGithubTargets {
			target := Target{Key: canonical, URL: url}
			if name != "" {
				target.Kind = model.RepositoryRepo
				target.Owner = owner
				target.Repo = name
			} else {
				target.Kind = model.RepositoryProfile
				target.Login = owner
			}
			result.Targets = append(result.Targets, target)
			result.Repositories = append(result.Repositories, model.Repository{
				URL:     url,
				Label:   label,
				Kind:    target.Kind,
				Status:  model.RepositoryUnavailable,
				Context: "",
				Detail:  "Chưa đọc dữ liệu GitHub",
			})
			return
		}

		detail := "Chưa hỗ trợ đọc mã nguồn"
		if isGithub {
			detail = "Chưa quét (giới hạn 3 mục GitHub)"
		}
		result.Repositories = append(result.Repositories, model.Repository{
			URL:    url,
			Label:  label,
			Kind:   model.RepositoryLink,
			Status: model.RepositorySkipped,
			Detail: detail,
		})
	}

	for _, indices := range repoLinkRe.FindAllStringSubmatchIndex(cvText, -1) {
		start, end := indices[0], indices[1]
		if start > 0 && isWordByte(cvText[start-1]) {
			continue
		}

		host := cvText[indices[2]:indices[3]]
		owner := cvText[indices[4]:indices[5]]
		repo := cvText[indices[6]:indices[7]]

		if strings.EqualFold(host, "github.com") {
			if _, reserved := reservedGithubPaths[strings.ToLower(owner)]; reserved {
				continue
			}
		}
		name := repo
		if strings.HasSuffix(strings.ToLower(name), ".git") {
			name = name[:len(name)-4]
		}
		if !loginRe.MatchString(owner) || !repoNameRe.MatchString(name) {
			continue
		}

		add(cvText[start:end], host, owner, repo)
	}

	for _, indices := range githubProfileRe.FindAllStringSubmatchIndex(cvText, -1) {
		start, end := indices[0], indices[1]
		if start > 0 && isWordByte(cvText[start-1]) {
			continue
		}
		if !boundaryAfter(cvText, end) {
			continue
		}

		login := strings.TrimRight(cvText[indices[2]:indices[3]], ".")
		if !loginRe.MatchString(login) {
			continue
		}
		if _, reserved := reservedGithubPaths[strings.ToLower(login)]; reserved {
			continue
		}

		add(cvText[start:end], "github.com", login, "")
	}

	return result
}

func isWordByte(char byte) bool {
	return char >= 'a' && char <= 'z' ||
		char >= 'A' && char <= 'Z' ||
		char >= '0' && char <= '9' ||
		char == '_' || char == '.' || char == '-'
}

func boundaryAfter(text string, index int) bool {
	if index >= len(text) {
		return true
	}
	switch text[index] {
	case ' ', '\t', '\r', '\n', ',', ';', ')', ']', '}', '>', '\'', '"':
		return true
	}
	return false
}

func cleanURL(value string) string {
	return strings.TrimRight(value, ".,;:!?)]}>'\"")
}

func withProtocol(value string) string {
	lower := strings.ToLower(value)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		return value
	}
	return "https://" + value
}
