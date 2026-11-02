"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Check,
  ChevronRight,
  Clipboard,
  FileCode2,
  Folder,
  FolderOpen,
  GitBranch,
  Info,
  Layers,
  Loader2,
  MessageSquare,
  Send,
  ShieldAlert,
} from "lucide-react";
import type { Finding, FindingState, Screen } from "@/data/codecv";
import { findingStateMeta, severityMeta } from "@/data/codecv";
import {
  analyzeRepositoryFindings,
  patchFinding,
  retryRepositories,
  sendRepositoryChatMessage,
  useCandidate,
  useCandidates,
  useRepository,
  useRepositoryChat,
  useRepositoryFile,
  type RepoRecord,
  type RepositoryChatMessage,
  type TreeNode,
} from "@/lib/api";
import { useNumberFormat, useT, type MessageKey } from "@/lib/i18n";
import {
  Avatar,
  CardHead,
  EmptyState,
  LoadError,
  Loading,
  PageHead,
  ScreenLoader,
} from "../ui";

function TreeNode({
  node,
  path,
  depth,
  selected,
  openFolders,
  toggles,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  path: string;
  depth: number;
  selected: string;
  openFolders: Set<string>;
  toggles: Record<string, boolean>;
  onToggle: (path: string, open: boolean) => void;
  onSelect: (path: string) => void;
}) {
  const full = path ? `${path}/${node.name}` : node.name;
  if (node.type === "folder") {
    const open = toggles[full] ?? (depth === 0 || openFolders.has(full));
    return (
      <li>
        <button
          type="button"
          className={`tree-folder${open ? " is-open" : ""}`}
          style={{ paddingLeft: depth * 12 + 4 }}
          aria-expanded={open}
          onClick={() => onToggle(full, open)}
        >
          <ChevronRight
            className="tree-caret"
            size={12}
            aria-hidden="true"
          />
          {open ? (
            <FolderOpen size={13} aria-hidden="true" />
          ) : (
            <Folder size={13} aria-hidden="true" />
          )}
          <span>{node.name}</span>
        </button>
        {open && node.children ? (
          <ul>
            {node.children.map((child) => (
              <TreeNode
                key={child.name}
                node={child}
                path={full}
                depth={depth + 1}
                selected={selected}
                openFolders={openFolders}
                toggles={toggles}
                onToggle={onToggle}
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
        <span className="tree-caret-space" aria-hidden="true" />
        <FileCode2 size={13} aria-hidden="true" />
        <span>{node.name}</span>
      </button>
    </li>
  );
}

function ancestorFolders(file: string): Set<string> {
  const parts = file.split("/");
  const folders = new Set<string>();
  let path = "";
  for (let index = 0; index < parts.length - 1; index += 1) {
    path = path ? `${path}/${parts[index]}` : parts[index];
    folders.add(path);
  }
  return folders;
}

function firstFilePath(nodes: TreeNode[], prefix = ""): string {
  for (const node of nodes) {
    const full = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "file") return full;
    const child = node.children ? firstFilePath(node.children, full) : "";
    if (child) return child;
  }
  return "";
}

function countFiles(nodes: TreeNode[]): number {
  return nodes.reduce(
    (sum, node) =>
      sum + (node.type === "file" ? 1 : countFiles(node.children ?? [])),
    0,
  );
}

const summaryFlagKeys: Record<string, MessageKey> = {
  manifest: "repository.flagManifest",
  tests: "repository.flagTests",
  docker: "repository.flagDocker",
  ci: "repository.flagCi",
  docs: "repository.flagDocs",
  license: "repository.flagLicense",
  migrations: "repository.flagMigrations",
  env: "repository.flagEnv",
};

const keyFileKindKeys: Record<string, MessageKey> = {
  manifest: "repository.keyKindManifest",
  container: "repository.keyKindContainer",
  ci: "repository.keyKindCi",
  docs: "repository.keyKindDocs",
  license: "repository.keyKindLicense",
  config: "repository.keyKindConfig",
  entry: "repository.keyKindEntry",
};

function moduleWidth(files: number, max: number): number {
  return Math.max(4, Math.round((files / Math.max(1, max)) * 100));
}

const TREE_MIN_WIDTH = 160;
const TREE_MAX_WIDTH = 420;
const TREE_DEFAULT_WIDTH = 188;
const TREE_RAIL_WIDTH = 320;
const TREE_MIN_VIEWER = 260;
const TREE_GAP = 16;
let treeWidthMemory = TREE_DEFAULT_WIDTH;

function clampTreeWidth(width: number, layoutWidth: number): number {
  const maxByViewer =
    layoutWidth > 0
      ? layoutWidth - TREE_RAIL_WIDTH - TREE_GAP * 2 - TREE_MIN_VIEWER
      : TREE_MAX_WIDTH;
  const max = Math.max(
    TREE_MIN_WIDTH,
    Math.min(TREE_MAX_WIDTH, maxByViewer),
  );
  return Math.min(Math.max(Math.round(width), TREE_MIN_WIDTH), max);
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

const CHAT_QUESTION_LIMIT = 2000;

function chatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function RepositoryChat({
  candidateId,
  repo,
  ready,
}: {
  candidateId: string;
  repo: string;
  ready: boolean;
}) {
  const t = useT();
  const history = useRepositoryChat(candidateId, repo || undefined);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [added, setAdded] = useState<RepositoryChatMessage[]>([]);
  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Lịch sử đã tải và các lượt vừa gửi có thể trùng sau khi tải lại; lọc theo id.
  const messages: RepositoryChatMessage[] = [];
  const seen = new Set<string>();
  for (const message of [...(history.data ?? []), ...added]) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    messages.push(message);
  }

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length, sending]);

  const send = async () => {
    const question = draft.trim();
    if (!question || !repo || !ready || sending) return;
    setSending(true);
    setSendError("");
    setPendingQuestion(question);
    setDraft("");
    try {
      const saved = await sendRepositoryChatMessage(
        candidateId,
        repo || undefined,
        question,
      );
      setAdded((prev) => [...prev, ...saved]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
      setDraft(question);
    } finally {
      setPendingQuestion("");
      setSending(false);
    }
  };

  const applySuggestion = (text: string) => {
    setDraft(text);
    inputRef.current?.focus();
  };

  const onComposerKeyDown = (
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    void send();
  };

  const showEmpty =
    !history.loading && !history.error && !messages.length && !sending;
  const suggestions = [
    t("repository.chatSuggestion1"),
    t("repository.chatSuggestion2"),
    t("repository.chatSuggestion3"),
  ];

  return (
    <section className="repo-chat card" aria-label={t("repository.chatAria")}>
      <CardHead
        title={t("repository.chatTitle")}
        meta={t("repository.chatMeta")}
      />
      {history.loading && !history.data ? (
        <div className="chat-state" role="status" aria-live="polite">
          <Loader2 className="spin" size={18} aria-hidden="true" />
          <span>{t("repository.chatLoading")}</span>
        </div>
      ) : history.error && !messages.length ? (
        <div className="chat-state">
          <p>{history.error}</p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={history.refetch}
          >
            {t("repository.chatRetry")}
          </button>
        </div>
      ) : (
        <div className="chat-log" ref={logRef} role="log" aria-live="polite">
          {showEmpty ? (
            <div className="chat-empty">
              <p className="chat-empty-title">
                {t("repository.chatEmptyTitle")}
              </p>
              <p className="chat-empty-detail">
                {t("repository.chatEmptyDetail")}
              </p>
              {ready ? (
                <div className="chat-suggestions">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="chat-suggestion"
                      onClick={() => applySuggestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="chat-notice">
                  {t("repository.chatNotReady")}
                </p>
              )}
            </div>
          ) : null}
          {messages.map((message) => {
            const mine = message.role === "user";
            return (
              <article
                key={message.id}
                className={`chat-turn is-${mine ? "user" : "assistant"}`}
              >
                <div className="chat-author">
                  <span>
                    {mine
                      ? t("repository.chatYou")
                      : t("repository.chatAssistant")}
                  </span>
                  {message.createdAt ? (
                    <span className="chat-time num">
                      {chatTime(message.createdAt)}
                    </span>
                  ) : null}
                </div>
                <div className="chat-bubble">{message.content}</div>
              </article>
            );
          })}
          {pendingQuestion ? (
            <article className="chat-turn is-user">
              <div className="chat-author">
                <span>{t("repository.chatYou")}</span>
              </div>
              <div className="chat-bubble">{pendingQuestion}</div>
            </article>
          ) : null}
          {sending ? (
            <article className="chat-turn is-assistant">
              <div className="chat-author">
                <span>{t("repository.chatAssistant")}</span>
                <span>{t("repository.chatThinking")}</span>
              </div>
              <div
                className="chat-bubble"
                role="status"
                aria-label={t("repository.chatThinking")}
              >
                <span className="chat-typing" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </article>
          ) : null}
        </div>
      )}
      {sendError ? (
        <p className="chat-error" role="alert">
          {sendError}
        </p>
      ) : null}
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="visually-hidden" htmlFor="repository-chat-input">
          {t("repository.chatPlaceholder")}
        </label>
        <textarea
          id="repository-chat-input"
          ref={inputRef}
          className="chat-input"
          rows={2}
          maxLength={CHAT_QUESTION_LIMIT}
          value={draft}
          disabled={!ready || !repo}
          placeholder={
            ready
              ? t("repository.chatPlaceholder")
              : t("repository.chatNotReady")
          }
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onComposerKeyDown}
        />
        <button
          type="submit"
          className="btn btn-primary chat-send"
          disabled={!ready || !repo || sending || !draft.trim()}
        >
          {sending ? (
            <Loader2 className="spin" size={14} aria-hidden="true" />
          ) : (
            <Send size={14} aria-hidden="true" />
          )}
          {sending
            ? t("repository.chatSending")
            : t("repository.chatSend")}
        </button>
      </form>
      <div className="chat-foot">
        <span className="foot-note">{t("repository.chatHint")}</span>
        <span className="foot-note">{t("repository.chatFoot")}</span>
      </div>
    </section>
  );
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
  const {
    data: candidate,
    loading,
    error,
    refetch,
    refresh: refreshCandidate,
  } = useCandidate(id);
  const [selectedRepo, setSelectedRepo] = useState("");
  const { data: repo, refresh: refreshRepo } = useRepository(id, selectedRepo);
  const t = useT();
  const nf = useNumberFormat();
  const findings = repo?.findings ?? [];
  const tree = repo?.tree ?? [];
  const layers = repo?.layers ?? [];
  const details = repo?.details ?? null;
  const summary = repo?.summary ?? null;
  const repositories = repo?.repositories ?? [];
  const repoItems = repositories.filter((item) => item.kind === "repo");
  const viewableRepos = repoItems.filter(
    (item) => item.status === "analyzed",
  );
  const analyzedRepos = viewableRepos.length;
  const pendingRepos = repoItems.filter(
    (item) => item.status === "pending" || item.status === "analyzing",
  ).length;
  const findingsRecord =
    repoItems.find(
      (item) => item.status === "analyzed" && item.url === repo?.repo,
    ) ?? null;
  const findingsState = findingsRecord?.findingsState ?? "";
  const findingsBusy =
    findingsState === "pending" || findingsState === "analyzing";
  const firstTreeFile = firstFilePath(tree);
  const fileCount = countFiles(tree);
  const fileTotal = details?.fileCount ?? fileCount;
  const [selectedId, setSelectedId] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [folderToggles, setFolderToggles] = useState<Record<string, boolean>>(
    {},
  );
  const [treeWidth, setTreeWidth] = useState(treeWidthMemory);
  const [resizingTree, setResizingTree] = useState(false);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const treeDrag = useRef<{
    startX: number;
    startWidth: number;
    layoutWidth: number;
  } | null>(null);
  const [states, setStates] = useState<Record<string, FindingState>>({});
  const [filter, setFilter] = useState<"all" | "needs" | "confirmed">("all");
  const [view, setView] = useState<"overview" | "arch" | "code">("overview");
  const [layerId, setLayerId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fileCopied, setFileCopied] = useState(false);
  const [retryingLabel, setRetryingLabel] = useState<string | null>(null);
  const [retryError, setRetryError] = useState("");
  const [analyzingFindings, setAnalyzingFindings] = useState(false);
  const [findingsError, setFindingsError] = useState("");

  useEffect(() => {
    if (!pendingRepos && !findingsBusy) return;
    const timer = window.setInterval(() => {
      refreshRepo();
      refreshCandidate();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pendingRepos, findingsBusy, refreshRepo, refreshCandidate]);

  useEffect(
    () => () => document.body.classList.remove("is-col-resizing"),
    [],
  );

  // Cây thư mục có thể rỗng với hồ sơ cũ; thử lại sẽ đưa repo về hàng đợi đọc.
  const retryRepository = async (label?: string) => {
    setRetryingLabel(label ?? "");
    setRetryError("");
    try {
      await retryRepositories(id, label);
      refreshRepo();
      refreshCandidate();
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetryingLabel(null);
    }
  };

  const analyzeFindings = async () => {
    setAnalyzingFindings(true);
    setFindingsError("");
    try {
      await analyzeRepositoryFindings(id, selectedRepo || repo?.repo || undefined);
      refreshRepo();
    } catch (err) {
      setFindingsError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzingFindings(false);
    }
  };

  const activeFile = selectedFile || firstTreeFile;
  const openFolders = ancestorFolders(activeFile);
  const stateOf = (finding: Finding) => states[finding.id] ?? finding.state;
  const explicitSelected =
    findings.find((item) => item.id === selectedId) ?? null;
  // Hồ sơ cũ chưa có cây thư mục: tab mã nguồn mở phát hiện đầu tiên.
  const selected =
    explicitSelected ??
    (view === "code" && !activeFile ? (findings[0] ?? null) : null);
  const layer = layers.find((item) => item.id === layerId) ?? null;
  const fileQuery = useRepositoryFile(
    id,
    view === "code" && !selected && activeFile ? activeFile : null,
    selectedRepo,
  );
  const fileData =
    fileQuery.data && fileQuery.data.path === activeFile
      ? fileQuery.data
      : null;
  const fileHits = new Set(
    findings.filter((item) => item.file === activeFile).map((item) => item.line),
  );

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
    selectedRepo ||
    repo?.repo ||
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
  const branch =
    repo?.repoBranch || (selectedRepo ? "" : candidate.repoBranch) || "";
  const commit =
    repo?.commit || (selectedRepo ? "" : candidate.commit) || "";
  const language =
    details?.language ||
    details?.languages[0]?.name ||
    (primaryRecord?.context ?? "").split("·")[0].trim();
  const primaryPending =
    primaryRecord?.status === "pending" || primaryRecord?.status === "analyzing";
  const primaryNeedsRetry = primaryRecord
    ? primaryRecord.status === "unavailable" ||
      primaryRecord.status === "skipped" ||
      (primaryRecord.status === "analyzed" && !primaryRecord.hasTree)
    : false;
  const truncatedFiles = Math.max(0, fileTotal - fileCount);
  const formatRepoDate = (value: string) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  };
  const formatSize = (kb: number) => {
    if (!kb) return "—";
    if (kb >= 1024) return `${nf(Math.round((kb / 1024) * 10) / 10)} MB`;
    return `${nf(kb)} KB`;
  };
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
    setSelectedId("");
    setView("code");
  };

  // Đổi repo thì bỏ mọi lựa chọn thuộc repo cũ để cây và khung xem tải lại.
  const switchRepo = (url: string) => {
    if (!url || url === primaryRepo) return;
    setSelectedRepo(url);
    setSelectedFile("");
    setSelectedId("");
    setFolderToggles({});
    setFileCopied(false);
    setLayerId(null);
    setFilter("all");
    setView("overview");
  };

  const toggleFolder = (path: string, open: boolean) => {
    setFolderToggles((prev) => ({ ...prev, [path]: !open }));
  };

  const applyTreeWidth = (width: number, layoutWidth: number) => {
    const next = clampTreeWidth(width, layoutWidth);
    treeWidthMemory = next;
    setTreeWidth(next);
  };

  const currentLayoutWidth = () =>
    layoutRef.current?.getBoundingClientRect().width ?? 0;

  const startTreeDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    treeDrag.current = {
      startX: event.clientX,
      startWidth: treeWidth,
      layoutWidth: currentLayoutWidth(),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizingTree(true);
    document.body.classList.add("is-col-resizing");
  };

  const moveTreeDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = treeDrag.current;
    if (!drag) return;
    applyTreeWidth(
      drag.startWidth + event.clientX - drag.startX,
      drag.layoutWidth,
    );
  };

  const endTreeDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!treeDrag.current) return;
    treeDrag.current = null;
    setResizingTree(false);
    document.body.classList.remove("is-col-resizing");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resizeTreeByKeyboard = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "Home") {
      event.preventDefault();
      applyTreeWidth(TREE_DEFAULT_WIDTH, currentLayoutWidth());
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 16 : -16;
    applyTreeWidth(treeWidth + delta, currentLayoutWidth());
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

  const copyFile = async () => {
    if (!fileData) return;
    try {
      await navigator.clipboard.writeText(fileData.content);
      setFileCopied(true);
      window.setTimeout(() => setFileCopied(false), 1600);
    } catch {
      setFileCopied(false);
    }
  };

  const startLine = selected
    ? Math.max(1, selected.line - (selected.hitLine - 1))
    : 1;

  const summaryBlock = summary ? (
    <section
      className="code-summary"
      aria-label={t("repository.codeSummaryAria")}
    >
      <div className="summary-head">
        <h3 className="summary-title">{t("repository.codeSummary")}</h3>
        <span className="summary-meta">
          {t("repository.codeSummaryMeta", {
            files: nf(summary.files),
            folders: nf(summary.folders),
          })}
        </span>
      </div>
      <div className="summary-stats">
        <span className="summary-stat">
          <span className="summary-stat-value num">{nf(summary.files)}</span>
          <span className="summary-stat-label">
            {t("repository.summaryFiles")}
          </span>
        </span>
        <span className="summary-stat">
          <span className="summary-stat-value num">{nf(summary.folders)}</span>
          <span className="summary-stat-label">
            {t("repository.summaryFolders")}
          </span>
        </span>
        <span className="summary-stat">
          <span className="summary-stat-value num">
            {formatSize(summary.sizeKb)}
          </span>
          <span className="summary-stat-label">
            {t("repository.summarySize")}
          </span>
        </span>
        <span className="summary-stat">
          <span className="summary-stat-value num">{nf(summary.tests)}</span>
          <span className="summary-stat-label">
            {t("repository.summaryTests")}
          </span>
        </span>
      </div>
      {summary.flags.length ? (
        <div className="summary-flags">
          {summary.flags.map((flag) => {
            const key = summaryFlagKeys[flag];
            return key ? (
              <span className="summary-flag" key={flag}>
                {t(key)}
              </span>
            ) : null;
          })}
        </div>
      ) : null}
      {summary.modules.length || summary.fileTypes.length ? (
        <div className="summary-grid">
          {summary.modules.length ? (
            <section className="summary-block">
              <h4 className="mini-title">{t("repository.summaryModules")}</h4>
              <ul className="module-list">
                {summary.modules.map((module) => (
                  <li className="module-row" key={module.name}>
                    <span className="module-name mono">{module.name}/</span>
                    <span className="module-track" aria-hidden="true">
                      <span
                        className="module-fill"
                        style={{
                          width: `${moduleWidth(
                            module.files,
                            summary.modules[0].files,
                          )}%`,
                        }}
                      />
                    </span>
                    <span className="module-count num">
                      {nf(module.files)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {summary.fileTypes.length ? (
            <section className="summary-block">
              <h4 className="mini-title">
                {t("repository.summaryFileTypes")}
              </h4>
              <div className="topic-list">
                {summary.fileTypes.map((type) => (
                  <span className="topic-chip" key={type.ext}>
                    {type.ext}{" "}
                    <span className="filetype-count num">
                      {nf(type.count)}
                    </span>
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
      {summary.keyFiles.length ? (
        <section className="summary-block">
          <h4 className="mini-title">{t("repository.summaryKeyFiles")}</h4>
          <ul className="keyfile-list">
            {summary.keyFiles.map((file) => {
              const kindKey = keyFileKindKeys[file.kind];
              return (
                <li className="keyfile-row" key={file.path}>
                  <span className="keyfile-path mono">{file.path}</span>
                  <span className="keyfile-kind">
                    {kindKey ? t(kindKey) : file.kind}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {summary.entrypoints.length ? (
        <section className="summary-block">
          <h4 className="mini-title">{t("repository.summaryEntrypoints")}</h4>
          <div className="topic-list">
            {summary.entrypoints.map((entry) => (
              <span className="topic-chip mono" key={entry}>
                {entry}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      <p className="summary-foot">{t("repository.summaryFootnote")}</p>
    </section>
  ) : null;

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
            {repositories.map((item) => {
              const reread = item.status === "analyzed";
              const canRetry =
                item.kind === "repo" &&
                (item.status === "unavailable" ||
                  item.status === "skipped" ||
                  (reread && !item.hasTree));
              return (
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
                  <span className="saved-repo-side">
                    <span className={`pill ${repoStatusClass(item.status)}`}>
                      {repoStatusLabel(item.status)}
                    </span>
                    {canRetry ? (
                      <button
                        type="button"
                        className="text-btn"
                        disabled={retryingLabel === item.label}
                        aria-label={t(
                          reread
                            ? "repository.rereadAria"
                            : "repository.retryAria",
                          { label: item.label },
                        )}
                        onClick={() => void retryRepository(item.label)}
                      >
                        {retryingLabel === item.label
                          ? t("repository.retrying")
                          : t(
                              reread ? "repository.reread" : "repository.retry",
                            )}
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
          {retryError ? (
            <p className="retry-error" role="alert">
              {retryError}
            </p>
          ) : null}
        </section>
      ) : null}

      {viewableRepos.length > 1 ? (
        <div className="repo-switch">
          <label className="repo-switch-label" htmlFor="repo-view-select">
            <GitBranch size={13} aria-hidden="true" />
            {t("repository.pickerLabel")}
          </label>
          <select
            id="repo-view-select"
            className="repo-switch-select mono"
            value={primaryRepo}
            onChange={(event) => switchRepo(event.target.value)}
          >
            {viewableRepos.map((item) => (
              <option key={item.url} value={item.url}>
                {item.label}
              </option>
            ))}
          </select>
          <span className="repo-switch-hint">
            {t("repository.pickerHint")}
          </span>
        </div>
      ) : null}

      <section
        className="repo-summary"
        aria-label={t("repository.summaryAria")}
      >
        <div className="repo-summary-main">
          <span className="repo-path mono">{primaryRepo}</span>
          {branch || fileTotal ? (
            <span className="repo-branch">
              <GitBranch size={13} aria-hidden="true" />
              {[
                branch,
                fileTotal
                  ? t("repository.filesCount", { count: fileTotal })
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
          {fileTotal ? (
            <div>
              <dt>{t("repository.files")}</dt>
              <dd className="num">{nf(fileTotal)}</dd>
            </div>
          ) : null}
          {details ? (
            <div>
              <dt>{t("repository.stars")}</dt>
              <dd className="num">{nf(details.stars)}</dd>
            </div>
          ) : null}
          {details ? (
            <div>
              <dt>{t("repository.forks")}</dt>
              <dd className="num">{nf(details.forks)}</dd>
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

      <div
        className="repo-layout"
        ref={layoutRef}
        style={{ "--tree-width": `${treeWidth}px` } as CSSProperties}
      >
        <div className="repo-tree-wrap">
          <aside className="repo-tree card" aria-label={t("repository.tree")}>
            <div className="tree-head">
              <span className="tree-title">{t("repository.tree")}</span>
              {branch ? (
                <span className="mono tree-branch">{branch}</span>
              ) : null}
            </div>
            {tree.length ? (
              <ul className="tree-root">
                {tree.map((node) => (
                  <TreeNode
                    key={node.name}
                    node={node}
                    path=""
                    depth={0}
                    selected={activeFile}
                    openFolders={openFolders}
                    toggles={folderToggles}
                    onToggle={toggleFolder}
                    onSelect={selectFile}
                  />
                ))}
              </ul>
            ) : (
              <div className="tree-empty">
                <p>
                  {primaryPending
                    ? t("repository.treePending")
                    : t("repository.treeEmpty")}
                </p>
                {primaryNeedsRetry ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={retryingLabel !== null}
                    onClick={() => void retryRepository()}
                  >
                    {retryingLabel !== null
                      ? t("repository.retrying")
                      : t("repository.reread")}
                  </button>
                ) : null}
              </div>
            )}
            {truncatedFiles > 0 ? (
              <p className="tree-note">
                {t("repository.treeTruncated", { count: truncatedFiles })}
              </p>
            ) : null}
            {commit || branch ? (
              <div className="tree-foot">
                {commit ? <span className="mono">{commit}</span> : <span />}
                {branch ? (
                  <span>{t("repository.branchLabel", { branch })}</span>
                ) : null}
              </div>
            ) : null}
          </aside>

          <button
            type="button"
            className={`tree-resizer${resizingTree ? " is-active" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label={t("repository.treeResizeAria")}
            aria-valuemin={TREE_MIN_WIDTH}
            aria-valuemax={TREE_MAX_WIDTH}
            aria-valuenow={treeWidth}
            title={t("repository.treeResizeAria")}
            onPointerDown={startTreeDrag}
            onPointerMove={moveTreeDrag}
            onPointerUp={endTreeDrag}
            onPointerCancel={endTreeDrag}
            onLostPointerCapture={endTreeDrag}
            onDoubleClick={() =>
              applyTreeWidth(TREE_DEFAULT_WIDTH, currentLayoutWidth())
            }
            onKeyDown={resizeTreeByKeyboard}
          />
        </div>

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
                aria-selected={view === "overview"}
                className={`detail-tab${view === "overview" ? " is-on" : ""}`}
                onClick={() => setView("overview")}
              >
                <Info size={13} aria-hidden="true" />
                {t("repository.overviewTab")}
              </button>
              {layers.length ? (
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
              ) : null}
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

          {view === "overview" ? (
            <div className="repo-overview">
              {details ? (
                <>
                  <p className="overview-desc">
                    {details.description || t("repository.noDescription")}
                  </p>
                  {summaryBlock}
                  <dl className="overview-facts">
                    <div>
                      <dt>{t("repository.stars")}</dt>
                      <dd className="num">{nf(details.stars)}</dd>
                    </div>
                    <div>
                      <dt>{t("repository.forks")}</dt>
                      <dd className="num">{nf(details.forks)}</dd>
                    </div>
                    <div>
                      <dt>{t("repository.watchers")}</dt>
                      <dd className="num">{nf(details.watchers)}</dd>
                    </div>
                    <div>
                      <dt>{t("repository.openIssues")}</dt>
                      <dd className="num">{nf(details.openIssues)}</dd>
                    </div>
                    <div>
                      <dt>{t("repository.size")}</dt>
                      <dd className="num">{formatSize(details.sizeKb)}</dd>
                    </div>
                    <div>
                      <dt>{t("repository.license")}</dt>
                      <dd>{details.license || "—"}</dd>
                    </div>
                    <div>
                      <dt>{t("repository.created")}</dt>
                      <dd className="num">{formatRepoDate(details.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>{t("repository.pushed")}</dt>
                      <dd className="num">{formatRepoDate(details.pushedAt)}</dd>
                    </div>
                    {details.homepage ? (
                      <div>
                        <dt>{t("repository.homepage")}</dt>
                        <dd>
                          <a
                            className="overview-link"
                            href={details.homepage}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {details.homepage.replace(/^https?:\/\//, "")}
                          </a>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {details.languages.length ? (
                    <section className="overview-block">
                      <h3 className="mini-title">{t("repository.languages")}</h3>
                      <ul className="lang-list">
                        {details.languages.map((lang) => (
                          <li className="lang-row" key={lang.name}>
                            <span className="lang-name">{lang.name}</span>
                            <span className="lang-track" aria-hidden="true">
                              <span
                                className="lang-fill"
                                style={{
                                  width: `${Math.max(2, Math.min(100, lang.percent))}%`,
                                }}
                              />
                            </span>
                            <span className="lang-pct num">
                              {nf(Math.round(lang.percent * 10) / 10)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  {details.topics.length ? (
                    <section className="overview-block">
                      <h3 className="mini-title">{t("repository.topics")}</h3>
                      <div className="topic-list">
                        {details.topics.map((topic) => (
                          <span className="topic-chip" key={topic}>
                            {topic}
                          </span>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {details.commits.length ? (
                    <section className="overview-block">
                      <h3 className="mini-title">{t("repository.commits")}</h3>
                      <ul className="commit-list">
                        {details.commits.map((item) => (
                          <li className="commit-row" key={item.sha}>
                            <span className="commit-sha mono">{item.sha}</span>
                            <span className="commit-msg">{item.message}</span>
                            <span className="commit-date num">
                              {formatRepoDate(item.date)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  {details.readme ? (
                    <section className="overview-block">
                      <h3 className="mini-title">{t("repository.readme")}</h3>
                      <pre className="repo-readme">{details.readme}</pre>
                      {details.readmeChars >
                      Array.from(details.readme).length ? (
                        <p className="foot-note">
                          {t("repository.readmeTrimmed", {
                            count: details.readmeChars,
                          })}
                        </p>
                      ) : null}
                    </section>
                  ) : null}
                </>
              ) : (
                <>
                  {summaryBlock}
                  <div className="overview-empty">
                    <p>
                      {primaryPending
                        ? t("repository.detailsPending")
                        : t("repository.detailsMissing")}
                    </p>
                    {primaryNeedsRetry ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={retryingLabel !== null}
                        onClick={() => void retryRepository()}
                      >
                        {retryingLabel !== null
                          ? t("repository.retrying")
                          : t("repository.reread")}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ) : view === "arch" ? (
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
          ) : activeFile ? (
            fileData ? (
              <>
                <div className="viewer-head">
                  <div className="viewer-path">
                    <FileCode2 size={15} aria-hidden="true" />
                    <span className="mono">{fileData.path}</span>
                  </div>
                  <div className="viewer-actions">
                    {fileData.truncated ? (
                      <span className="pill pill-neutral">
                        {t("repository.fileTruncated")}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={t("repository.copyFile")}
                      onClick={copyFile}
                    >
                      {fileCopied ? (
                        <Check size={15} />
                      ) : (
                        <Clipboard size={15} />
                      )}
                    </button>
                  </div>
                </div>
                <pre
                  className="code-block code-block-file"
                  aria-label={t("repository.fileAria")}
                >
                  <code>
                    {fileData.content.split("\n").map((line, index) => {
                      const lineNo = index + 1;
                      const hit = fileHits.has(lineNo);
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
                <p className="code-note">{t("repository.fileFootnote")}</p>
              </>
            ) : fileQuery.error && !fileQuery.loading ? (
              <div className="file-state">
                <p>{fileQuery.error}</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={fileQuery.refetch}
                >
                  {t("repository.fileRetry")}
                </button>
              </div>
            ) : (
              <Loading label={t("repository.fileLoading")} />
            )
          ) : (
            <EmptyState
              title={t("repository.noFile")}
              detail={t("repository.noFileDetail")}
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
              findingsState === "analyzing"
                ? t("repository.findingsAnalyzingMeta")
                : findingsState === "pending"
                  ? t("repository.findingsPendingMeta")
                  : findingsState === "failed"
                    ? t("repository.findingsFailedMeta")
                    : findingsState === ""
                      ? t("repository.findingsNotRunMeta")
                      : layer
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
          {findings.length > 0 && !findingsBusy ? (
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
          ) : null}
          {!findingsBusy &&
          findings.length > 0 &&
          (findingsState === "failed" || findingsState === "") ? (
            <div className="rail-notice">
              <span>
                {findingsState === "failed"
                  ? findingsRecord?.findingsDetail ||
                    t("repository.findingsFailedDetail")
                  : t("repository.findingsNotRunDetail")}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={analyzeFindings}
                disabled={analyzingFindings}
              >
                {analyzingFindings
                  ? t("repository.findingsQueueing")
                  : findingsState === "failed"
                    ? t("repository.findingsRetry")
                    : t("repository.findingsAnalyze")}
              </button>
            </div>
          ) : null}
          <div className="finding-rail-list">
            {findingsBusy ? (
              <div className="rail-state">
                <p className="rail-state-title">
                  {findingsState === "analyzing"
                    ? t("repository.findingsAnalyzingTitle")
                    : t("repository.findingsPendingTitle")}
                </p>
                <p className="rail-state-detail">
                  {findingsRecord?.findingsDetail ||
                    t("repository.findingsRunningDetail")}
                </p>
              </div>
            ) : findingsState === "failed" && !findings.length ? (
              <div className="rail-state is-error">
                <p className="rail-state-title">
                  {t("repository.findingsFailedTitle")}
                </p>
                <p className="rail-state-detail">
                  {findingsRecord?.findingsDetail ||
                    t("repository.findingsFailedDetail")}
                </p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={analyzeFindings}
                  disabled={analyzingFindings}
                >
                  {analyzingFindings
                    ? t("repository.findingsQueueing")
                    : t("repository.findingsRetry")}
                </button>
              </div>
            ) : findingsState === "" && !findings.length ? (
              <div className="rail-state">
                <p className="rail-state-title">
                  {t("repository.findingsNotRunTitle")}
                </p>
                <p className="rail-state-detail">
                  {t("repository.findingsNotRunDetail")}
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={analyzeFindings}
                  disabled={analyzingFindings}
                >
                  {analyzingFindings
                    ? t("repository.findingsQueueing")
                    : t("repository.findingsAnalyze")}
                </button>
              </div>
            ) : visibleFindings.length ? (
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
              <p className="rail-empty">
                {findings.length
                  ? t("repository.railEmpty")
                  : t("repository.railClean")}
              </p>
            )}
          </div>
          <div className="card-foot">
            <span className="foot-note">
              {findingsError || t("repository.railFootnote")}
            </span>
          </div>
        </aside>
      </div>

      <RepositoryChat
        key={primaryRepo}
        candidateId={candidate.id}
        repo={primaryRepo}
        ready={tree.length > 0}
      />
    </div>
  );
}
