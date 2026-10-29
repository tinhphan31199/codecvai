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
  const { data: repo } = useRepository(id);
  const t = useT();
  const nf = useNumberFormat();
  const findings = candidate?.findings ?? [];
  const tree = repo?.tree ?? [];
  const layers = repo?.layers ?? [];
  const [selectedId, setSelectedId] = useState(findings[0]?.id ?? "");
  const [selectedFile, setSelectedFile] = useState(
    findings[0]?.file ?? "src/Orders.Infrastructure/Messaging/RabbitMqConsumer.cs",
  );
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

  if (candidate.repoState !== "connected" || !candidate.repo) {
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
            {candidate.name} · <span className="mono">{candidate.repo}</span> ·{" "}
            <span className="mono">
              {candidate.repoBranch}@{candidate.commit}
            </span>{" "}
            ·{" "}
            <span className="nowrap">
              {t("repository.analyzedAt", { date: "26/10 · 14:10" })}
            </span>
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

      <section
        className="repo-summary"
        aria-label={t("repository.summaryAria")}
      >
        <div className="repo-summary-main">
          <span className="repo-path mono">{candidate.repo}</span>
          <span className="repo-branch">
            <GitBranch size={13} aria-hidden="true" />
            {t("repository.branchMeta", {
              branch: "main",
              commits: nf(318),
              files: nf(42),
            })}
          </span>
        </div>
        <dl className="repo-facts">
          <div>
            <dt>{t("repository.language")}</dt>
            <dd>C# · .NET 8</dd>
          </div>
          <div>
            <dt>{t("repository.tests")}</dt>
            <dd className="num">{t("repository.testsValue")}</dd>
          </div>
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
              <span className="pill pill-positive">
                {t("repository.connected")}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <div className="repo-layout">
        <aside className="repo-tree card" aria-label={t("repository.tree")}>
          <div className="tree-head">
            <span className="tree-title">{t("repository.tree")}</span>
            <span className="mono tree-branch">main</span>
          </div>
          <ul className="tree-root">
            {(tree as TreeNodeData[]).map((node) => (
              <TreeNode
                key={node.name}
                node={node}
                path=""
                depth={0}
                selected={selectedFile}
                onSelect={selectFile}
              />
            ))}
          </ul>
          <div className="tree-foot">
            <span className="mono">{candidate.commit}</span>
            <span>{t("repository.branchLabel", { branch: "main" })}</span>
          </div>
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
                file: selectedFile.split("/").pop() ?? t("repository.thisFile"),
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
