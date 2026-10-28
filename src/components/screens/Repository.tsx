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
  const candidates = data ?? [];
  const connected = candidates.filter(
    (item) => item.repoState === "connected",
  );
  const unavailable = candidates.length - connected.length;

  return (
    <div className="screen">
      <PageHead
        title="Repository Analysis"
        sub="Chọn một ứng viên để xem cấu trúc mã nguồn và các phát hiện của họ."
      />
      {loading ? (
        <Loading label="Đang tải danh sách ứng viên…" />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : connected.length ? (
        <>
          <section className="card repo-picker">
            <CardHead
              title="Ứng viên đã kết nối repository"
              meta={`${connected.length} hồ sơ`}
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
              {unavailable} hồ sơ chưa kết nối repository — chỉ liệt kê ứng viên
              đã kết nối để phân tích.
            </p>
          ) : null}
        </>
      ) : (
        <section className="card">
          <EmptyState
            title="Chưa có ứng viên nào kết nối repository"
            detail="Tải CV lên và kết nối repository GitHub để bắt đầu phân tích mã nguồn."
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => go("upload")}
              >
                Tải CV lên
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
    return <ScreenLoader title="Repository Analysis" />;
  }

  if (error) {
    return (
      <div className="screen">
        <PageHead title="Repository Analysis" />
        <LoadError message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="screen">
        <EmptyState
          title="Không tìm thấy hồ sơ"
          detail="Hồ sơ có thể đã bị lưu trữ hoặc đường dẫn không đúng."
          action={
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => go("candidates")}
            >
              Về danh sách ứng viên
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
          title="Repository Analysis"
          sub={`${candidate.name} · ${candidate.position}`}
        />
        <section className="card">
          <div className="callout callout-negative">
            <ShieldAlert size={17} aria-hidden="true" />
            <div>
              <p className="callout-title">Repository chưa truy cập được</p>
              <p className="callout-body">
                Repository riêng tư hoặc token đã hết hạn. Cấp lại quyền để đọc
                commit, cấu trúc và kiểm thử.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => go("upload")}
            >
              Cấp lại quyền
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
        title="Repository Analysis"
        sub={
          <>
            {candidate.name} · <span className="mono">{candidate.repo}</span> ·{" "}
            <span className="mono">
              {candidate.repoBranch}@{candidate.commit}
            </span>{" "}
            ·{" "}
            <span className="nowrap">phân tích lúc 26/10 · 14:10</span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => go("candidate", candidate.id)}
            >
              Mở hồ sơ
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => go("interview", candidate.id)}
            >
              <MessageSquare size={15} aria-hidden="true" />
              Dùng trong phỏng vấn
            </button>
          </>
        }
      />

      <section className="repo-summary" aria-label="Tổng quan repository">
        <div className="repo-summary-main">
          <span className="repo-path mono">{candidate.repo}</span>
          <span className="repo-branch">
            <GitBranch size={13} aria-hidden="true" />
            main · 318 commit · 42 tệp
          </span>
        </div>
        <dl className="repo-facts">
          <div>
            <dt>Ngôn ngữ</dt>
            <dd>C# · .NET 8</dd>
          </div>
          <div>
            <dt>Kiểm thử</dt>
            <dd className="num">12 test · 68%</dd>
          </div>
          <div>
            <dt>Phát hiện</dt>
            <dd className="num">
              {findings.length} · {needed} cần xem
            </dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd>
              <span className="pill pill-positive">Đã kết nối</span>
            </dd>
          </div>
        </dl>
      </section>

      <div className="repo-layout">
        <aside className="repo-tree card" aria-label="Cây thư mục">
          <div className="tree-head">
            <span className="tree-title">Cây thư mục</span>
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
            <span>nhánh main</span>
          </div>
        </aside>

        <section className="repo-viewer card" aria-label="Kiến trúc và mã nguồn">
          <div className="viewer-tabs-bar">
            <div className="detail-tabs viewer-tabs" role="tablist" aria-label="Chế độ xem">
              <button
                type="button"
                role="tab"
                aria-selected={view === "arch"}
                className={`detail-tab${view === "arch" ? " is-on" : ""}`}
                onClick={() => setView("arch")}
              >
                <Layers size={13} aria-hidden="true" />
                Kiến trúc
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "code"}
                className={`detail-tab${view === "code" ? " is-on" : ""}`}
                onClick={() => setView("code")}
              >
                <FileCode2 size={13} aria-hidden="true" />
                Mã nguồn
              </button>
            </div>
            {layer ? (
              <button
                type="button"
                className="text-btn"
                onClick={() => setLayerId(null)}
              >
                Bỏ lọc lớp {layer.label}
              </button>
            ) : null}
          </div>

          {view === "arch" ? (
            <div className="arch-map">
              <p className="arch-intro">
                Chỉ hiển thị thành phần có bằng chứng trong code. Chọn một lớp
                để lọc phát hiện ở cột bên phải.
              </p>
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
                          {item.evidence} bằng chứng
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
                {findings.length} phát hiện gắn với entrypoint, handler,
                aggregate và adapter đã đọc.
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
                    dòng {selected.line}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Sao chép đoạn mã"
                    onClick={copyCode}
                  >
                    {copied ? <Check size={15} /> : <Clipboard size={15} />}
                  </button>
                </div>
              </div>
              <pre className="code-block" aria-label="Đoạn mã liên quan">
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
                    aria-label={`Mức ${severityMeta[selected.severity].label}`}
                  />
                  <div className="finding-detail-main">
                    <h2>{selected.title}</h2>
                    <span className="finding-loc">
                      {selected.module} · <span className="mono">{selected.file}</span>:
                      {selected.line}
                    </span>
                  </div>
                  <span className={`pill ${findingStateMeta[stateOf(selected)].className}`}>
                    {findingStateMeta[stateOf(selected)].label}
                  </span>
                </div>
                <div className="finding-detail-grid">
                  <div>
                    <h3 className="mini-title">Vì sao đáng chú ý</h3>
                    <p className="detail-p">{selected.rationale}</p>
                  </div>
                  <div>
                    <h3 className="mini-title">Cách xác minh</h3>
                    <p className="detail-p">{selected.verification}</p>
                  </div>
                </div>
                <div className="finding-actions">
                  {stateOf(selected) === "confirmed" ? (
                    <>
                      <span className="save-state" role="status">
                        Đã xác nhận, dùng được làm bằng chứng trong báo cáo.
                      </span>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => setFindingState(selected, selected.state)}
                      >
                        Bỏ xác nhận
                      </button>
                    </>
                  ) : stateOf(selected) === "dismissed" ? (
                    <>
                      <span className="foot-note">Đã bỏ qua phát hiện này.</span>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => setFindingState(selected, selected.state)}
                      >
                        Hoàn tác
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
                        Xác nhận phát hiện
                      </button>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => setFindingState(selected, "dismissed")}
                      >
                        Bỏ qua
                      </button>
                      <span className="foot-note">
                        Chỉ xác nhận sau khi đã chạy bước kiểm chứng.
                      </span>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              title={`Không có phát hiện trong ${selectedFile.split("/").pop() ?? "tệp này"}`}
              detail="AI chưa có bằng chứng trong tệp này. Chọn tệp có đánh dấu trong cây thư mục hoặc một phát hiện ở cột bên phải."
            />
          )}
        </section>

        <aside className="repo-findings card" aria-label="Danh sách phát hiện">
          <CardHead
            title="Phát hiện"
            meta={
              layer
                ? `${visibleFindings.length}/${findings.length} · lớp ${layer.label}`
                : `${findings.length} · ${needed} cần xem`
            }
          />
          <div className="chip-group chip-group-sm" role="group" aria-label="Lọc phát hiện">
            <button
              type="button"
              className={`chip${filter === "all" ? " is-on" : ""}`}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              Tất cả <span className="num">{findings.length}</span>
            </button>
            <button
              type="button"
              className={`chip${filter === "needs" ? " is-on" : ""}`}
              aria-pressed={filter === "needs"}
              onClick={() => setFilter("needs")}
            >
              Cần xem <span className="num">{needed}</span>
            </button>
            <button
              type="button"
              className={`chip${filter === "confirmed" ? " is-on" : ""}`}
              aria-pressed={filter === "confirmed"}
              onClick={() => setFilter("confirmed")}
            >
              Đã xác nhận <span className="num">{confirmed}</span>
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
                    aria-label={`Mức ${severityMeta[finding.severity].label}`}
                  />
                  <span className="finding-item-main">
                    <span className="finding-item-title">{finding.title}</span>
                    <span className="finding-item-file mono">
                      {finding.file.split("/").pop()}:{finding.line}
                    </span>
                    <span className="finding-item-meta">
                      {severityMeta[finding.severity].label} ·{" "}
                      {findingStateMeta[stateOf(finding)].label}
                    </span>
                  </span>
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              ))
            ) : (
              <p className="rail-empty">
                Không có phát hiện ở trạng thái này.
              </p>
            )}
          </div>
          <div className="card-foot">
            <span className="foot-note">
              Phát hiện là suy luận có nguồn, không phải kết luận tuyển dụng.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
