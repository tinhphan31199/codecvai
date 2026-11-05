"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bookmark,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Download,
  Eye,
  Loader2,
  LockKeyhole,
  MapPin,
  Search,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import {
  downloadMarketCV,
  saveMarketCV,
  useLevels,
  useMarketCVs,
  useModels,
  type MarketCV,
  type MarketUploadResponse,
} from "@/lib/api";
import { authToken, clearSession, useAuthSession } from "@/lib/auth";
import { MAX_FILE_BYTES } from "@/lib/cv-analysis";
import {
  getLang,
  localeOf,
  useLang,
  useT,
  type MessageKey,
} from "@/lib/i18n";
import {
  Avatar,
  CardHead,
  EmptyState,
  LoadError,
  PageHead,
  ScreenLoader,
} from "../ui";
import MarketDetail from "./MarketDetail";

type PickedFile = { file: File; name: string; bytes: number };
type Phase = "idle" | "uploading" | "analyzing" | "done" | "error";
type YearsFilter = "all" | "0-1" | "2-3" | "4-5" | "6";
type SortKey = "recent" | "experience" | "name";
type Scope = "all" | "saved" | "mine";
type MarketErrorBody = { error?: { code?: string; message?: string } };

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

const MARKET_CATEGORIES = [
  "backend",
  "frontend",
  "fullstack",
  "mobile",
  "devops",
  "data",
  "qa",
  "product",
  "design",
  "security",
  "other",
] as const;

type CategorySlug = (typeof MARKET_CATEGORIES)[number];

const formatSize = (bytes: number, locale: string) => {
  const kb = bytes / 1024;
  const value = kb < 1000 ? kb : kb / 1024;
  const unit = kb < 1000 ? "KB" : "MB";
  const digits = value >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)} ${unit}`;
};

const matchesYears = (years: number, bucket: YearsFilter) => {
  switch (bucket) {
    case "0-1":
      return years <= 1;
    case "2-3":
      return years >= 2 && years <= 3;
    case "4-5":
      return years >= 4 && years <= 5;
    case "6":
      return years >= 6;
    default:
      return true;
  }
};

export default function Market() {
  const { data: cvs, loading, error: loadError, refetch, refresh } = useMarketCVs();
  const { data: models } = useModels();
  const { data: levelCatalog } = useLevels();
  const session = useAuthSession();
  const t = useT();
  const lang = useLang();
  const locale = localeOf(lang);
  const myId = session?.user.id ?? "";

  const list = useMemo(() => cvs ?? [], [cvs]);
  const activeModels = useMemo(
    () => (models ?? []).filter((item) => item.active),
    [models],
  );
  const levelOrder = useMemo(
    () => (levelCatalog ?? []).map((item) => item.name),
    [levelCatalog],
  );

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | CategorySlug>("all");
  const [level, setLevel] = useState("all");
  const [years, setYears] = useState<YearsFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [scope, setScope] = useState<Scope>("all");
  const [selected, setSelected] = useState<MarketCV | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [modelChoice, setModelChoice] = useState("");
  const model = activeModels.some((item) => item.id === modelChoice)
    ? modelChoice
    : (activeModels[0]?.id ?? "");

  const [file, setFile] = useState<PickedFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<MarketCV | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLElement>(null);

  const running = phase === "uploading" || phase === "analyzing";

  const categoryLabel = (slug: string) => {
    const known = (MARKET_CATEGORIES as readonly string[]).includes(slug);
    return t(`market.category.${known ? slug : "other"}` as MessageKey);
  };

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cv of list) {
      counts.set(cv.category, (counts.get(cv.category) ?? 0) + 1);
    }
    return counts;
  }, [list]);

  const savedCount = useMemo(
    () => list.filter((cv) => cv.saved).length,
    [list],
  );
  const mineCount = useMemo(
    () => (myId ? list.filter((cv) => cv.ownerId === myId).length : 0),
    [list, myId],
  );

  const visibleCategories = useMemo(
    () => MARKET_CATEGORIES.filter((slug) => (categoryCounts.get(slug) ?? 0) > 0),
    [categoryCounts],
  );

  const levels = useMemo(() => {
    const present = new Set(
      list.map((cv) => cv.level).filter((value) => value !== ""),
    );
    const ordered = levelOrder.filter((name) => present.has(name));
    const extra = Array.from(present)
      .filter((name) => !levelOrder.includes(name))
      .sort((a, b) => a.localeCompare(b, "vi"));
    return [...ordered, ...extra];
  }, [levelOrder, list]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = list.filter((cv) => {
      if (scope === "saved" && !cv.saved) return false;
      if (scope === "mine" && (!myId || cv.ownerId !== myId)) return false;
      if (category !== "all" && cv.category !== category) return false;
      if (level !== "all" && cv.level !== level) return false;
      if (!matchesYears(cv.years, years)) return false;
      if (!q) return true;
      return `${cv.name} ${cv.title} ${cv.location} ${cv.summary} ${cv.skills.join(" ")}`
        .toLowerCase()
        .includes(q);
    });
    if (sort === "experience") {
      return [...filtered].sort((a, b) => b.years - a.years);
    }
    if (sort === "name") {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }
    return filtered;
  }, [category, level, list, myId, query, scope, sort, years]);

  const filtered = Boolean(
    query || category !== "all" || level !== "all" || years !== "all",
  );

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setLevel("all");
    setYears("all");
  };

  const scrollToList = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  };

  const toggleSaved = async (cv: MarketCV) => {
    if (savingId) return;
    setSavingId(cv.id);
    setActionError(null);
    try {
      await saveMarketCV(cv.id, !cv.saved);
      refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("market.saveError"),
      );
    } finally {
      setSavingId(null);
    }
  };

  const downloadCV = async (cv: MarketCV) => {
    if (downloadingId) return;
    setDownloadingId(cv.id);
    setActionError(null);
    try {
      await downloadMarketCV(cv.id);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t("market.downloadError"),
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDetailChange = (updated: MarketCV | null) => {
    setSelected(updated);
    refresh();
  };

  const pick = (selected: File) => {
    setUploadError(null);
    setResult(null);
    setPhase("idle");

    const name = selected.name.toLowerCase();
    const accepted =
      name.endsWith(".pdf") ||
      name.endsWith(".docx") ||
      selected.type === "application/pdf" ||
      selected.type === DOCX_MIME;

    if (!accepted) {
      setFile(null);
      setUploadError(t("upload.error.type"));
      return;
    }
    if (selected.size === 0) {
      setFile(null);
      setUploadError(t("upload.error.empty"));
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFile(null);
      setUploadError(t("upload.error.tooLarge"));
      return;
    }

    setFile({ file: selected, name: selected.name, bytes: selected.size });
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (running) return;
    const selected = event.dataTransfer.files?.[0];
    if (selected) pick(selected);
  };

  const start = () => {
    if (!file || running || !model) return;

    const form = new FormData();
    form.append("file", file.file);
    form.append("language", getLang() === "en" ? "English" : "Tiếng Việt");
    form.append("model", model);

    setPhase("uploading");
    setUploadError(null);
    setResult(null);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/market/cvs`);
    const token = authToken();
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.responseType = "json";
    xhr.timeout = 150_000;

    xhr.upload.onload = () => setPhase("analyzing");

    xhr.onload = () => {
      const body = xhr.response as
        | MarketUploadResponse
        | MarketErrorBody
        | null;

      if (xhr.status === 401) {
        clearSession();
        setPhase("idle");
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300 && body && "cv" in body) {
        setResult(body.cv);
        setPhase("done");
        setFile(null);
        resetFilters();
        void refetch();
        return;
      }

      setPhase("error");
      setUploadError(
        body && "error" in body && body.error?.message
          ? body.error.message
          : t("upload.error.server", { status: xhr.status }),
      );
    };

    xhr.onerror = () => {
      setPhase("error");
      setUploadError(t("upload.error.network"));
    };
    xhr.ontimeout = () => {
      setPhase("error");
      setUploadError(t("upload.error.timeout"));
    };

    xhr.send(form);
  };

  const fileNote =
    phase === "done"
      ? t("market.fileDone")
      : phase === "analyzing"
        ? t("market.fileAnalyzing")
        : phase === "uploading"
          ? t("market.fileUploading")
          : t("market.fileIdle");

  if (loading && !cvs) {
    return (
      <ScreenLoader
        title={t("screen.market")}
        label={t("market.loadingLabel")}
      />
    );
  }

  if (loadError && !cvs) {
    return (
      <div className="screen">
        <PageHead title={t("screen.market")} />
        <LoadError message={loadError} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="screen">
      <PageHead title={t("screen.market")} sub={t("market.sub")} />

      <section className="card market-upload">
        <div className="market-upload-copy">
          <span className="market-upload-icon" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <div>
            <h2>{t("market.uploadTitle")}</h2>
            <p className="market-upload-sub">{t("market.uploadSub")}</p>
          </div>
        </div>

        <div className="market-upload-form">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="visually-hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) pick(selected);
              event.target.value = "";
            }}
          />

          {file ? (
            <div className="file-card">
              <span className="file-icon" aria-hidden="true">
                {running ? (
                  <Loader2 className="spin" size={22} />
                ) : (
                  <UploadCloud size={22} />
                )}
              </span>
              <div className="file-main">
                <span className="file-name">{file.name}</span>
                <span className="file-meta">
                  {formatSize(file.bytes, locale)} · {fileNote}
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label={t("market.uploadPick")}
                disabled={running}
                onClick={() => setFile(null)}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              className={`dropzone market-dropzone${dragging ? " is-drag" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={t("market.uploadDropTitle")}
              onClick={() => {
                if (!running) inputRef.current?.click();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (!running) inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!running) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <UploadCloud size={20} aria-hidden="true" />
              <p className="drop-title">{t("market.uploadDropTitle")}</p>
              <p className="drop-sub">{t("market.uploadDropSub")}</p>
            </div>
          )}

          <div className="market-upload-controls">
            <label className="filter-select market-model">
              <span className="visually-hidden">{t("market.uploadModel")}</span>
              <select
                value={model}
                onChange={(event) => setModelChoice(event.target.value)}
                disabled={running || activeModels.length === 0}
                aria-label={t("market.uploadModel")}
              >
                {activeModels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={start}
              disabled={!file || running || !model}
            >
              {running ? (
                <Loader2 className="spin" size={15} aria-hidden="true" />
              ) : (
                <Sparkles size={15} aria-hidden="true" />
              )}
              {phase === "uploading"
                ? t("market.uploadUploading")
                : phase === "analyzing"
                  ? t("market.uploadAnalyzing")
                  : t("market.uploadAction")}
            </button>
          </div>

          {activeModels.length === 0 ? (
            <p className="market-hint">{t("market.uploadNoModel")}</p>
          ) : null}

          {uploadError ? (
            <div className="callout callout-negative market-error" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              <div>
                <p className="callout-title">{t("market.uploadErrorTitle")}</p>
                <p className="callout-body">{uploadError}</p>
              </div>
            </div>
          ) : null}

          {result ? (
            <div className="market-result" role="status">
              <CheckCircle2 size={18} aria-hidden="true" />
              <div className="market-result-main">
                <span className="market-result-title">
                  {t("market.uploadSuccess")}
                </span>
                <span className="market-result-meta">
                  {result.level
                    ? t("market.uploadSuccessMeta", {
                        category: categoryLabel(result.category),
                        level: result.level,
                      })
                    : t("market.uploadSuccessNoLevel", {
                        category: categoryLabel(result.category),
                      })}{" "}
                  · {result.name}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={scrollToList}
              >
                {t("market.uploadView")}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelected(result)}
              >
                {t("market.actionDetail")}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card market-browser" ref={listRef}>
        <CardHead
          title={t("market.browseTitle")}
          meta={t("market.total", { count: list.length })}
        />

        <div
          className="market-scope"
          role="group"
          aria-label={t("market.scopeAria")}
        >
          <button
            type="button"
            className={`chip${scope === "all" ? " is-on" : ""}`}
            aria-pressed={scope === "all"}
            onClick={() => setScope("all")}
          >
            {t("market.scopeAll")} <span className="num">{list.length}</span>
          </button>
          <button
            type="button"
            className={`chip${scope === "saved" ? " is-on" : ""}`}
            aria-pressed={scope === "saved"}
            onClick={() => setScope("saved")}
          >
            {t("market.scopeSaved")} <span className="num">{savedCount}</span>
          </button>
          <button
            type="button"
            className={`chip${scope === "mine" ? " is-on" : ""}`}
            aria-pressed={scope === "mine"}
            disabled={!myId}
            onClick={() => setScope("mine")}
          >
            {t("market.scopeMine")} <span className="num">{mineCount}</span>
          </button>
        </div>

        {actionError ? (
          <div
            className="callout callout-negative market-browser-error"
            role="alert"
          >
            <CircleAlert size={16} aria-hidden="true" />
            <div className="callout-grow">
              <p className="callout-title">{t("market.actionErrorTitle")}</p>
              <p className="callout-body">{actionError}</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={t("market.actionClose")}
              onClick={() => setActionError(null)}
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        <div className="filter-bar">
          <div className="filter-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("market.searchPlaceholder")}
              aria-label={t("market.searchAria")}
            />
            {query ? (
              <button
                type="button"
                className="filter-clear"
                aria-label={t("market.clearFilters")}
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <label className="filter-select">
            <span className="visually-hidden">{t("market.levelAria")}</span>
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              aria-label={t("market.levelAria")}
            >
              <option value="all">{t("market.allLevels")}</option>
              {levels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-select">
            <span className="visually-hidden">{t("market.yearsAria")}</span>
            <select
              value={years}
              onChange={(event) =>
                setYears(event.target.value as YearsFilter)
              }
              aria-label={t("market.yearsAria")}
            >
              <option value="all">{t("market.allYears")}</option>
              <option value="0-1">{t("market.years01")}</option>
              <option value="2-3">{t("market.years23")}</option>
              <option value="4-5">{t("market.years45")}</option>
              <option value="6">{t("market.years6")}</option>
            </select>
          </label>

          <label className="filter-select">
            <span className="visually-hidden">{t("market.sortAria")}</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              aria-label={t("market.sortAria")}
            >
              <option value="recent">{t("market.sortRecent")}</option>
              <option value="experience">{t("market.sortExperience")}</option>
              <option value="name">{t("market.sortName")}</option>
            </select>
          </label>
        </div>

        <div className="filter-row">
          <div
            className="chip-group"
            role="group"
            aria-label={t("market.categoryAria")}
          >
            <button
              type="button"
              className={`chip${category === "all" ? " is-on" : ""}`}
              aria-pressed={category === "all"}
              onClick={() => setCategory("all")}
            >
              {t("market.allCategories")}{" "}
              <span className="num">{list.length}</span>
            </button>
            {visibleCategories.map((slug) => (
              <button
                key={slug}
                type="button"
                className={`chip${category === slug ? " is-on" : ""}`}
                aria-pressed={category === slug}
                onClick={() => setCategory(slug)}
              >
                {categoryLabel(slug)}{" "}
                <span className="num">{categoryCounts.get(slug) ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="filter-summary">
            {filtered ? (
              <button
                type="button"
                className="text-btn"
                onClick={resetFilters}
              >
                {t("market.clearFilters")}
              </button>
            ) : null}
            <span className="result-count">
              {t("market.resultCount", { count: rows.length })}
            </span>
          </div>
        </div>

        {rows.length ? (
          <div className="market-grid">
            {rows.map((cv) => (
              <article className="market-card" key={cv.id}>
                <div className="market-card-top">
                  <Avatar
                    initials={cv.initials}
                    hue={cv.hue}
                    size={40}
                    name={cv.name}
                  />
                  <div className="market-card-id">
                    <h3>{cv.name}</h3>
                    <p>{cv.title || t("market.noTitle")}</p>
                  </div>
                  <span className="market-category">
                    {categoryLabel(cv.category)}
                  </span>
                </div>

                <div className="market-meta">
                  {cv.level ? (
                    <span className="pill pill-info">{cv.level}</span>
                  ) : null}
                  {cv.years > 0 ? (
                    <span>
                      <BriefcaseBusiness size={13} aria-hidden="true" />
                      {t("market.experience", { count: cv.years })}
                    </span>
                  ) : null}
                  {cv.location ? (
                    <span>
                      <MapPin size={13} aria-hidden="true" />
                      {cv.location}
                    </span>
                  ) : null}
                  {cv.visibility === "private" ? (
                    <span className="market-private-tag">
                      <LockKeyhole size={11} aria-hidden="true" />
                      {t("market.private")}
                    </span>
                  ) : null}
                </div>

                {cv.summary ? (
                  <p className="market-summary">{cv.summary}</p>
                ) : null}

                {cv.skills.length ? (
                  <div className="market-skills">
                    {cv.skills.slice(0, 8).map((skill) => (
                      <span className="market-skill" key={skill}>
                        {skill}
                      </span>
                    ))}
                    {cv.skills.length > 8 ? (
                      <span className="market-skill">
                        +{cv.skills.length - 8}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {cv.highlights.length ? (
                  <ul className="market-highlights">
                    {cv.highlights.slice(0, 2).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}

                <footer className="market-card-foot">
                  <div className="market-foot-left">
                    <span>
                      {t("market.uploadedBy", {
                        name: cv.uploadedBy || t("market.anonymous"),
                      })}
                    </span>
                    {cv.email ? (
                      <a href={`mailto:${cv.email}`}>{cv.email}</a>
                    ) : null}
                    <span className="market-foot-date">{cv.createdAt}</span>
                  </div>
                  <div className="market-card-actions">
                    <button
                      type="button"
                      className={`icon-btn market-save${cv.saved ? " is-on" : ""}`}
                      aria-pressed={cv.saved}
                      aria-label={
                        cv.saved
                          ? t("market.actionSaved")
                          : t("market.actionSave")
                      }
                      title={
                        cv.saved
                          ? t("market.actionSaved")
                          : t("market.actionSave")
                      }
                      disabled={savingId === cv.id}
                      onClick={() => void toggleSaved(cv)}
                    >
                      {savingId === cv.id ? (
                        <Loader2 className="spin" size={14} />
                      ) : (
                        <Bookmark
                          size={14}
                          fill={cv.saved ? "currentColor" : "none"}
                        />
                      )}
                    </button>
                    {cv.hasCv ? (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t("market.actionDownload")}
                        title={t("market.actionDownload")}
                        disabled={downloadingId === cv.id}
                        onClick={() => void downloadCV(cv)}
                      >
                        {downloadingId === cv.id ? (
                          <Loader2 className="spin" size={14} />
                        ) : (
                          <Download size={14} />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelected(cv)}
                    >
                      <Eye size={13} aria-hidden="true" />
                      {t("market.actionDetail")}
                    </button>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        ) : list.length ? (
          scope === "saved" ? (
            <EmptyState
              title={t("market.savedEmptyTitle")}
              detail={t("market.savedEmptyDetail")}
              action={
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setScope("all")}
                >
                  {t("market.scopeAll")}
                </button>
              }
            />
          ) : scope === "mine" ? (
            <EmptyState
              title={t("market.mineEmptyTitle")}
              detail={t("market.mineEmptyDetail")}
              action={
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => inputRef.current?.click()}
                >
                  <UploadCloud size={14} aria-hidden="true" />
                  {t("market.uploadPick")}
                </button>
              }
            />
          ) : (
            <EmptyState
              title={t("market.noMatchTitle")}
              detail={t("market.noMatchDetail")}
              action={
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={resetFilters}
                >
                  {t("market.clearFilters")}
                </button>
              }
            />
          )
        ) : (
          <EmptyState
            title={t("market.emptyTitle")}
            detail={t("market.emptyDetail")}
            action={
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => inputRef.current?.click()}
              >
                <UploadCloud size={14} aria-hidden="true" />
                {t("market.uploadPick")}
              </button>
            }
          />
        )}
      </section>

      {selected ? (
        <MarketDetail
          cv={selected}
          onClose={() => setSelected(null)}
          onChanged={handleDetailChange}
        />
      ) : null}
    </div>
  );
}
