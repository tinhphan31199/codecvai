"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  Clipboard,
  FileCode2,
  Folder,
  GitBranch,
  Layers,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import type { Finding, FindingState, Screen } from "@/data/codecv";
import { findingStateMeta, severityMeta } from "@/data/codecv";
import {
  patchFinding,
  useCandidate,
  useCandidates,
  useRepository,
  type RepoRecord,
} from "@/lib/api";
import { useNumberFormat, useT } from "@/lib/i18n";
import {
  Avatar,
  CardHead,
  EmptyState,
  LoadError,
  Loading,
  PageHead,
  ScreenLoader,
} from "../ui";

type TreeNodeData = {
  name: string;
  type: "folder" | "file";
  active?: boolean;
  children?: TreeNodeData[];
};

function TreeNode({
  node,
  path,
  depth,
  selected,
  onSelect,
}: {
  node: TreeNodeData;
  path: string;
  depth: number;
  selected: string;
  onSelect: (path: string) => void;
}) {
  const full = path ? `${path}/${node.name}` : node.name;
  if (node.type === "folder") {
    return (
      <li>
        <div className="tree-folder" style={{ paddingLeft: depth * 12 + 4 }}>
          <Folder size={13} aria-hidden="true" />
          <span>{node.name}</span>
        </div>
        {node.children ? (
          <ul>
            {node.children.map((child) => (
              <TreeNode
                key={child.name}
                node={child}
                path={full}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }
  const active = selected === full;
  return (
    <li>
      <button
        type="button"
        className={`tree-file${active ? " is-on" : ""}`}
        style={{ paddingLeft: depth * 12 + 4 }}
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(full)}
      >
        <FileCode2 size={13} aria-hidden="true" />
        <span>{node.name}</span>
      </button>
    </li>
  );
}

function firstFilePath(nodes: TreeNodeData[], prefix = ""): string {
  for (const node of nodes) {
    const full = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "file") return full;
    const child = node.children ? firstFilePath(node.children, full) : "";
    if (child) return child;
  }
  return "";
}

function countFiles(nodes: TreeNodeData[]): number {
  return nodes.reduce(
    (sum, node) =>
      sum + (node.type === "file" ? 1 : countFiles(node.children ?? [])),
    0,
  );
}

export default function RepositoryScreen({
  id,
  go,
}: {
  id?: string;
  go: (screen: Screen, id?: string) => void;
}) {
  if (!id) {
    return <RepositoryPicker go={go} />;
  }
  return <RepositoryAnalysis id={id} go={go} />;
}

function RepositoryPicker({
  go,
}: {
  go: (screen: Screen, id?: string) => void;
}) {
  const { data, loading, error, refetch } = useCandidates();
  const t = useT();
  const candidates = data ?? [];
  const connected = candidates.filter(
    (item) => item.repoState === "connected",
  );
  const unavailable = candidates.length - connected.length;

  return (
    <div className="screen">
      <PageHead
        title={t("screen.repository")}
        sub={t("repository.pickerSub")}
      />
      {loading ? (
        <Loading label={t("repository.pickerLoading")} />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : connected.length ? (
        <>
          <section className="card repo-picker">
            <CardHead
              title={t("repository.connectedTitle")}
              meta={t("repository.profilesCount", { count: connected.length })}
            />
            <ul className="picker-list">
              {connected.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="picker-item"
                    onClick={() => go("repository", item.id)}
                  >
                    <Avatar
                      initials={item.initials}
                      hue={item.hue}
                      size={34}
                      name={item.name}
                    />
                    <span className="picker-main">
                      <span className="picker-name">{item.name}</span>
                      <span className="picker-sub">
                        {item.position} · {item.level}
                      </span>
                    </span>
                    <span className="picker-repo">
                      <GitBranch size={13} aria-hidden="true" />
                      <span className="mono">{item.repo}</span>
                    </span>
                    <ChevronRight
                      size={16}
                      className="picker-chev"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {unavailable > 0 ? (
            <p className="foot-note">
              {t("repository.unavailableNote", { count: unavailable })}
            </p>
          ) : null}
        </>
      ) : (
        <section className="card">
          <EmptyState
            title={t("repository.emptyTitle")}
            detail={t("repository.emptyDetail")}
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => go("upload")}
              >
                {t("repository.uploadCv")}
              </button>
            }
          />
        </section>
      )}
    </div>
  );
}

function RepositoryAnalysis({
  id,
  go,
}: {
  id: string;
  go: (screen: Screen, id?: string) => void;
}) {
  const { data: candidate, loading, error, refetch } = useCandidate(id);
  const { data: repo, refresh: refreshRepo } = useRepository(id);
  const t = useT();
  const nf = useNumberFormat();
  const findings = candidate?.findings ?? [];
  const tree = repo?.tree ?? [];
  const layers = repo?.layers ?? [];
  const repositories = repo?.repositories ?? [];
  const repoItems = repositories.filter((item) => item.kind === "repo");
  const analyzedRepos = repoItems.filter(
    (item) => item.status === "analyzed",
  ).length;
  const pendingRepos = repoItems.filter(
    (item) => item.status === "pending" || item.status === "analyzing",
  ).length;
  const firstTreeFile = firstFilePath(tree);
  const fileCount = countFiles(tree);
  const [selectedId, setSelectedId] = useState(findings[0]?.id ?? "");
  const [selectedFile, setSelectedFile] = useState(findings[0]?.file ?? "");
  const [states, setStates] = useState<Record<string, FindingState>>({});
  const [filter, setFilter] = useState<"all" | "needs" | "confirmed">("all");
  const [view, setView] = useState<"arch" | "code">("arch");
  const [layerId, setLayerId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (findings.length) {
      setSelectedId(findings[0].id);
      setSelectedFile(findings[0].file);
    }
  }, [findings]);

  useEffect(() => {
    if (!pendingRepos) return;
    const timer = window.setInterval(() => refreshRepo(), 5000);
    return () => window.clearInterval(timer);
  }, [pendingRepos, refreshRepo]);

  const activeFile = selectedFile || firstTreeFile;

  const stateOf = (finding: Finding) => states[finding.id] ?? finding.state;
  const selected = findings.find((item) => item.id === selectedId) ?? null;
  const layer = layers.find((item) => item.id === layerId) ?? null;

  if (loading) {
    return <ScreenLoader title={t("screen.repository")} />;
  }

  if (error) {
    return (
      <div className="screen">
        <PageHead title={t("screen.repository")} />
        <LoadError message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="screen">
        <EmptyState
          title={t("repository.notFound")}
          detail={t("repository.notFoundDetail")}
          action={
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => go("candidates")}
            >
              {t("repository.backToCandidates")}
            </button>
          }
        />
      </div>
    );
  }

  const primaryRepo =
    candidate.repo ||
    repoItems.find((item) => item.status === "analyzed")?.url ||
    repoItems[0]?.url ||
    "";

  const repoStatusClass = (status: RepoRecord["status"]) =>
    status === "analyzed"
      ? "pill-positive"
      : status === "unavailable"
        ? "pill-negative"
        : "pill-neutral";

  const repoStatusLabel = (status: RepoRecord["status"]) => {
    switch (status) {
      case "analyzed":
        return t("repository.repoStatusAnalyzed");
      case "pending":
        return t("repository.repoStatusPending");
      case "analyzing":
        return t("repository.repoStatusAnalyzing");
      case "skipped":
        return t("repository.repoStatusSkipped");
      default:
        return t("repository.repoStatusUnavailable");
    }
  };

  const primaryRecord =
    repoItems.find(
      (item) => item.status === "analyzed" && item.url === primaryRepo,
    ) ??
    repoItems.find((item) => item.status === "analyzed") ??
    null;
  const branch = repo?.repoBranch || candidate.repoBranch || "";
  const commit = repo?.commit || candidate.commit || "";
  const language = (primaryRecord?.context ?? "").split("·")[0].trim();
  const analyzedAt = (() => {
    if (!primaryRecord?.updatedAt) return "";
    const date = new Date(primaryRecord.updatedAt);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} · ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  })();
  const statusClass = primaryRecord
    ? repoStatusClass(primaryRecord.status)
    : candidate.repoState === "connected"
      ? "pill-positive"
      : "pill-negative";
  const statusLabel = primaryRecord
    ? repoStatusLabel(primaryRecord.status)
    : candidate.repoState === "connected"
      ? t("repository.connected")
      : t("repository.repoStatusUnavailable");

  if (
    !repositories.length &&
    (candidate.repoState !== "connected" || !candidate.repo)
  ) {
    return (
      <div className="screen">
        <PageHead
          title={t("screen.repository")}
          sub={`${candidate.name} · ${candidate.position}`}
        />
        <section className="card">
          <div className="callout callout-negative">
            <ShieldAlert size={17} aria-hidden="true" />
            <div>
              <p className="callout-title">{t("repository.inaccessibleTitle")}</p>
              <p className="callout-body">
                {t("repository.inaccessibleBody")}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => go("upload")}
            >
              {t("repository.regrant")}
            </button>
          </div>
        </section>
      </div>
    );
  }

  const selectFile = (path: string) => {
    setSelectedFile(path);
    setView("code");
    const match = findings.find((item) => item.file === path);
    setSelectedId(match?.id ?? "");
  };

  const setFindingState = async (finding: Finding, state: FindingState) => {
    setStates((prev) => ({ ...prev, [finding.id]: state }));
    try {
      await patchFinding(id, finding.id, state);
    } catch {
      setStates((prev) => {
        const next = { ...prev };
        delete next[finding.id];
        return next;
      });
    }
  };

  const needed = findings.filter((item) =>
    ["open", "needs-check"].includes(stateOf(item)),
  ).length;
  const confirmed = findings.filter((item) => stateOf(item) === "confirmed").length;

  const visibleFindings = findings.filter((item) => {
    if (layer && !item.file.includes(layer.path)) return false;
    if (filter === "needs") return ["open", "needs-check"].includes(stateOf(item));
    if (filter === "confirmed") return stateOf(item) === "confirmed";
    return true;
  });

  const copyCode = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const startLine = selected
    ? Math.max(1, selected.line - (selected.hitLine - 1))
    : 1;

  return (
    <div className="screen">
      <PageHead
        title={t("screen.repository")}
        sub={
          <>
            {candidate.name} ·{" "}
            <span className="mono">{primaryRepo || "—"}</span>
            {branch || commit ? (
              <>
                {" · "}
                <span className="mono">
                  {commit ? (branch ? `${branch}@${commit}` : commit) : branch}
                </span>
              </>
            ) : null}
            {analyzedAt ? (
              <>
                {" · "}
                <span className="nowrap">
                  {t("repository.analyzedAt", { date: analyzedAt })}
                </span>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => go("candidate", candidate.id)}
            >
              {t("repository.openProfile")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => go("interview", candidate.id)}
            >
              <MessageSquare size={15} aria-hidden="true" />
              {t("repository.useInInterview")}
            </button>
          </>
        }
      />

      {repositories.length ? (
        <section
          className="card repo-saved"
          aria-label={t("repository.savedTitle")}
        >
          <CardHead
            title={t("repository.savedTitle")}
            meta={t("repository.savedMeta", {
              total: repoItems.length,
              analyzed: analyzedRepos,
              pending: pendingRepos,
            })}
          />
          <ul className="saved-repo-list">
            {repositories.map((item) => (
              <li className="saved-repo" key={`${item.kind}-${item.label}`}>
                <GitBranch size={13} aria-hidden="true" />
                <span className="saved-repo-main">
                  <a
                    className="saved-repo-label mono"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.label}
                  </a>
                  {item.context ? (
                    <span className="saved-repo-context">{item.context}</span>
                  ) : null}
                  {item.detail ? (
                    <span className="saved-repo-detail">{item.detail}</span>
                  ) : null}
                </span>
                <span className={`pill ${repoStatusClass(item.status)}`}>
                  {repoStatusLabel(item.status)}
                </span>
              </li>
            ))}
          </ul>
          {pendingRepos ? (
            <div className="card-foot">
              <span className="foot-note">
                {t("repository.savedPendingNote", { count: pendingRepos })}
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      <section
        className="repo-summary"
        aria-label={t("repository.summaryAria")}
      >
        <div className="repo-summary-main">
          <span className="repo-path mono">{primaryRepo}</span>
          {branch || fileCount ? (
            <span className="repo-branch">
              <GitBranch size={13} aria-hidden="true" />
              {[
                branch,
                fileCount
                  ? t("repository.filesCount", { count: fileCount })
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : null}
        </div>
        <dl className="repo-facts">
          {language ? (
            <div>
              <dt>{t("repository.language")}</dt>
              <dd>{language}</dd>
            </div>
          ) : null}
          {fileCount ? (
            <div>
              <dt>{t("repository.files")}</dt>
              <dd className="num">{nf(fileCount)}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t("repository.findings")}</dt>
            <dd className="num">
              {t("repository.findingsSummary", {
                total: findings.length,
                needed,
              })}
            </dd>
          </div>
          <div>
            <dt>{t("repository.status")}</dt>
            <dd>
              <span className={`pill ${statusClass}`}>{statusLabel}</span>
            </dd>
          </div>
        </dl>
      </section>

      <div className="repo-layout">
        <aside className="repo-tree card" aria-label={t("repository.tree")}>
          <div className="tree-head">
            <span className="tree-title">{t("repository.tree")}</span>
            {branch ? <span className="mono tree-branch">{branch}</span> : null}
          </div>
          <ul className="tree-root">
            {(tree as TreeNodeData[]).map((node) => (
              <TreeNode
                key={node.name}
                node={node}
                path=""
                depth={0}
                selected={activeFile}
                onSelect={selectFile}
              />
            ))}
          </ul>
          {commit || branch ? (
            <div className="tree-foot">
              {commit ? <span className="mono">{commit}</span> : <span />}
              {branch ? (
                <span>{t("repository.branchLabel", { branch })}</span>
              ) : null}
            </div>
          ) : null}
        </aside>

        <section className="repo-viewer card" aria-label={t("repository.viewerAria")}>
          <div className="viewer-tabs-bar">
            <div
              className="detail-tabs viewer-tabs"
              role="tablist"
              aria-label={t("repository.viewModeAria")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={view === "arch"}
                className={`detail-tab${view === "arch" ? " is-on" : ""}`}
                onClick={() => setView("arch")}
              >
                <Layers size={13} aria-hidden="true" />
                {t("repository.archTab")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "code"}
                className={`detail-tab${view === "code" ? " is-on" : ""}`}
                onClick={() => setView("code")}
              >
                <FileCode2 size={13} aria-hidden="true" />
                {t("repository.codeTab")}
              </button>
            </div>
            {layer ? (
              <button
                type="button"
                className="text-btn"
                onClick={() => setLayerId(null)}
              >
                {t("repository.clearLayer", { layer: layer.label })}
              </button>
            ) : null}
          </div>

          {view === "arch" ? (
            <div className="arch-map">
              <p className="arch-intro">{t("repository.archIntro")}</p>
              <div className="arch-flow">
                {layers.map((item, index) => (
                  <div className="arch-step" key={item.id}>
                    {index > 0 ? (
                      <span className="arch-arrow" aria-hidden="true">
                        ↓
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`arch-layer${layerId === item.id ? " is-on" : ""}`}
                      aria-pressed={layerId === item.id}
                      onClick={() =>
                        setLayerId(layerId === item.id ? null : item.id)
                      }
                    >
                      <span className="arch-layer-head">
                        <span className="arch-layer-label">{item.label}</span>
                        <span className="arch-layer-evidence num">
                          {t("repository.layerEvidence", {
                            count: item.evidence,
                          })}
                        </span>
                      </span>
                      <span className="arch-layer-tech">{item.tech}</span>
                      <span className="arch-nodes">
                        {item.nodes.map((node) => (
                          <span className="arch-node" key={node}>
                            {node}
                          </span>
                        ))}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
              <p className="foot-note">
                {t("repository.archFootnote", { count: findings.length })}
              </p>
            </div>
          ) : selected ? (
            <>
              <div className="viewer-head">
                <div className="viewer-path">
                  <FileCode2 size={15} aria-hidden="true" />
                  <span className="mono">{selected.file}</span>
                </div>
                <div className="viewer-actions">
                  <span className="pill pill-neutral">
                    {t("repository.line", { line: nf(selected.line) })}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t("repository.copyCode")}
                    onClick={copyCode}
                  >
                    {copied ? <Check size={15} /> : <Clipboard size={15} />}
                  </button>
                </div>
              </div>
              <pre className="code-block" aria-label={t("repository.codeAria")}>
                <code>
                  {selected.code.split("\n").map((line, index) => {
                    const lineNo = startLine + index;
                    const hit = lineNo === selected.line;
                    return (
                      <span
                        className={`code-line${hit ? " is-hit" : ""}`}
                        key={`${lineNo}-${index}`}
                      >
                        <span className="ln num" aria-hidden="true">
                          {lineNo}
                        </span>
                        <span className="code-text">{line || " "}</span>
                      </span>
                    );
                  })}
                </code>
              </pre>
              <div className="finding-detail">
                <div className="finding-detail-head">
                  <span
                    className={`sev-dot ${severityMeta[selected.severity].className}`}
                    aria-label={t("repository.severityAria", {
                      level: t(severityMeta[selected.severity].labelKey),
                    })}
                  />
                  <div className="finding-detail-main">
                    <h2>{selected.title}</h2>
                    <span className="finding-loc">
                      {selected.module} · <span className="mono">{selected.file}</span>:
                      {selected.line}
                    </span>
                  </div>
                  <span className={`pill ${findingStateMeta[stateOf(selected)].className}`}>
                    {t(findingStateMeta[stateOf(selected)].labelKey)}
                  </span>
                </div>
                <div className="finding-detail-grid">
                  <div>
                    <h3 className="mini-title">{t("repository.whyNotable")}</h3>
                    <p className="detail-p">{selected.rationale}</p>
                  </div>
                  <div>
                    <h3 className="mini-title">{t("repository.howToVerify")}</h3>
                    <p className="detail-p">{selected.verification}</p>
                  </div>
                </div>
                <div className="finding-actions">
                  {stateOf(selected) === "confirmed" ? (
                    <>
                      <span className="save-state" role="status">
                        {t("repository.confirmedNote")}
                      </span>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => setFindingState(selected, selected.state)}
                      >
                        {t("repository.unconfirm")}
                      </button>
                    </>
                  ) : stateOf(selected) === "dismissed" ? (
                    <>
                      <span className="foot-note">
                        {t("repository.dismissedNote")}
                      </span>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => setFindingState(selected, selected.state)}
                      >
                        {t("repository.undo")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setFindingState(selected, "confirmed")}
                      >
                        <Check size={14} aria-hidden="true" />
                        {t("repository.confirmFinding")}
                      </button>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => setFindingState(selected, "dismissed")}
                      >
                        {t("repository.dismiss")}
                      </button>
                      <span className="foot-note">
                        {t("repository.confirmHint")}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              title={t("repository.noFindingInFile", {
                file: activeFile.split("/").pop() || t("repository.thisFile"),
              })}
              detail={t("repository.noFindingInFileDetail")}
            />
          )}
        </section>

        <aside
          className="repo-findings card"
          aria-label={t("repository.findingsAria")}
        >
          <CardHead
            title={t("repository.findings")}
            meta={
              layer
                ? t("repository.filteredByLayer", {
                    visible: visibleFindings.length,
                    total: findings.length,
                    layer: layer.label,
                  })
                : t("repository.findingsSummary", {
                    total: findings.length,
                    needed,
                  })
            }
          />
          <div
            className="chip-group chip-group-sm"
            role="group"
            aria-label={t("repository.filterAria")}
          >
            <button
              type="button"
              className={`chip${filter === "all" ? " is-on" : ""}`}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              {t("repository.filterAll")}{" "}
              <span className="num">{findings.length}</span>
            </button>
            <button
              type="button"
              className={`chip${filter === "needs" ? " is-on" : ""}`}
              aria-pressed={filter === "needs"}
              onClick={() => setFilter("needs")}
            >
              {t("repository.filterNeeds")}{" "}
              <span className="num">{needed}</span>
            </button>
            <button
              type="button"
              className={`chip${filter === "confirmed" ? " is-on" : ""}`}
              aria-pressed={filter === "confirmed"}
              onClick={() => setFilter("confirmed")}
            >
              {t("finding.confirmed")}{" "}
              <span className="num">{confirmed}</span>
            </button>
          </div>
          <div className="finding-rail-list">
            {visibleFindings.length ? (
              visibleFindings.map((finding) => (
                <button
                  type="button"
                  key={finding.id}
                  className={`finding-item${selected?.id === finding.id ? " is-on" : ""}`}
                  onClick={() => {
                    setSelectedId(finding.id);
                    setSelectedFile(finding.file);
                    setView("code");
                  }}
                >
                  <span
                    className={`sev-dot ${severityMeta[finding.severity].className}`}
                    aria-label={t("repository.severityAria", {
                      level: t(severityMeta[finding.severity].labelKey),
                    })}
                  />
                  <span className="finding-item-main">
                    <span className="finding-item-title">{finding.title}</span>
                    <span className="finding-item-file mono">
                      {finding.file.split("/").pop()}:{finding.line}
                    </span>
                    <span className="finding-item-meta">
                      {t("repository.severityState", {
                        severity: t(severityMeta[finding.severity].labelKey),
                        state: t(findingStateMeta[stateOf(finding)].labelKey),
                      })}
                    </span>
                  </span>
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              ))
            ) : (
              <p className="rail-empty">{t("repository.railEmpty")}</p>
            )}
          </div>
          <div className="card-foot">
            <span className="foot-note">{t("repository.railFootnote")}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
