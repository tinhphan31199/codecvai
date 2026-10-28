package links

import (
	"strings"
	"testing"

	"codecv/backend/internal/model"
)

func TestExtractRepositoriesAndProfile(t *testing.T) {
	cv := `Projects:
- https://github.com/acme/payment-gateway.git
- github.com/acme/order-service, và github.com/acme/payment-gateway
- https://gitlab.com/acme/internal-tools
Profile: https://github.com/octocat
`

	result := Extract(cv)

	if len(result.Repositories) != 4 {
		t.Fatalf("expected 4 repositories, got %d: %+v", len(result.Repositories), result.Repositories)
	}
	if len(result.Targets) != 3 {
		t.Fatalf("expected 3 github targets, got %d", len(result.Targets))
	}

	byLabel := make(map[string]model.Repository, len(result.Repositories))
	for _, repository := range result.Repositories {
		byLabel[repository.Label] = repository
	}

	payment, ok := byLabel["github.com/acme/payment-gateway"]
	if !ok {
		t.Fatalf("missing payment-gateway entry: %+v", byLabel)
	}
	if payment.URL != "https://github.com/acme/payment-gateway" {
		t.Fatalf("unexpected url: %s", payment.URL)
	}
	if payment.Kind != model.RepositoryRepo {
		t.Fatalf("unexpected kind: %s", payment.Kind)
	}

	gitlab, ok := byLabel["gitlab.com/acme/internal-tools"]
	if !ok {
		t.Fatalf("missing gitlab entry: %+v", byLabel)
	}
	if gitlab.Kind != model.RepositoryLink || gitlab.Status != model.RepositorySkipped {
		t.Fatalf("gitlab entry should be skipped link, got %+v", gitlab)
	}

	profile, ok := byLabel["github.com/octocat"]
	if !ok {
		t.Fatalf("missing profile entry: %+v", byLabel)
	}
	if profile.Kind != model.RepositoryProfile {
		t.Fatalf("unexpected profile kind: %s", profile.Kind)
	}

	if result.Targets[0].Kind != model.RepositoryRepo || result.Targets[0].Repo != "payment-gateway" {
		t.Fatalf("unexpected first target: %+v", result.Targets[0])
	}
	if result.Targets[2].Kind != model.RepositoryProfile || result.Targets[2].Login != "octocat" {
		t.Fatalf("unexpected profile target: %+v", result.Targets[2])
	}
}

func TestExtractRespectsLimits(t *testing.T) {
	cv := `github.com/acme/one github.com/acme/two github.com/acme/three
github.com/acme/four github.com/acme/five github.com/acme/six`

	result := Extract(cv)

	if len(result.Repositories) != 5 {
		t.Fatalf("expected 5 repositories, got %d", len(result.Repositories))
	}
	if len(result.Targets) != 3 {
		t.Fatalf("expected 3 targets, got %d", len(result.Targets))
	}
	for index, repository := range result.Repositories {
		if index < 3 {
			if repository.Kind != model.RepositoryRepo {
				t.Fatalf("entry %d should be a github repo, got %+v", index, repository)
			}
			continue
		}
		if repository.Status != model.RepositorySkipped {
			t.Fatalf("entry %d should be skipped, got %+v", index, repository)
		}
	}
}

func TestExtractSkipsReservedGithubPaths(t *testing.T) {
	for _, candidate := range []string{
		"https://github.com/features/copilot",
		"https://github.com/search?q=go",
		"https://github.com/orgs/acme/repositories",
	} {
		result := Extract(candidate)
		if len(result.Repositories) != 0 {
			t.Fatalf("%s should not produce repositories: %+v", candidate, result.Repositories)
		}
	}
}

func TestExtractNormalizesProfilePunctuation(t *testing.T) {
	result := Extract("Liên hệ: github.com/octocat.")

	if len(result.Repositories) != 1 {
		t.Fatalf("expected 1 repository, got %+v", result.Repositories)
	}
	if result.Repositories[0].URL != "https://github.com/octocat" {
		t.Fatalf("unexpected url: %s", result.Repositories[0].URL)
	}
	if !strings.Contains(result.Repositories[0].Detail, "Chưa đọc") {
		t.Fatalf("unexpected detail: %s", result.Repositories[0].Detail)
	}
}
