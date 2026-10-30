"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  CircleAlert,
  Download,
  ExternalLink,
  Eye,
  FileText,
  GitBranch,
  Info,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import type { Screen } from "@/data/codecv";
import {
  useAnalysisQueue,
  useLevels,
  useModels,
  usePositions,
  useStages,
  useTeams,
} from "@/lib/api";
import { authToken, clearSession } from "@/lib/auth";
import {
  localeOf,
  useLang,
  useNumberFormat,
  useT,
  type MessageKey,
  type Vars,
} from "@/lib/i18n";
import {
  MAX_FILE_BYTES,
  type AnalyzeCvErrorBody,
  type CvAnalysisResponse,
} from "@/lib/cv-analysis";
import {
  Avatar,
  CardHead,
  EmptyState,
  EvidenceMeter,
  EvidencePill,
  Loading,
  LoadError,
  PageHead,
  ScreenLoader,
} from "../ui";

type PickedFile = {
  file: File;
  name: string;
  bytes: number;
};

type Phase = "idle" | "uploading" | "analyzing" | "done" | "error";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

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

const formatSeconds = (milliseconds: number, locale: string) =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(milliseconds / 1000);

const relativeTime = (
  value: string,
  t: (key: MessageKey, vars?: Vars) => string,
  locale: string,
) => {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return t("upload.queueTimeJustNow");
  if (minutes < 60) return t("upload.queueTimeMinutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("upload.queueTimeHoursAgo", { count: hours });
  if (hours < 48) return t("upload.queueTimeYesterday");
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(then);
};

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || "CV";

const hueOf = (name: string) => {
  let hue = 0;
  for (const char of name) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
};

const languageOptions: { value: string; labelKey: MessageKey }[] = [
  { value: "Tiếng Việt", labelKey: "upload.langVi" },
  { value: "English", labelKey: "upload.langEn" },
];

export default function UploadCV({
  go,
}: {
  go: (screen: Screen, id?: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const numberFormat = useNumberFormat();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CvAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analysis, setAnalysis] = useState({
    jd: true,
    questions: true,
  });
  const [positionId, setPositionId] = useState("be-dotnet");
  const [teamChoice, setTeamChoice] = useState("");
  const [level, setLevel] = useState("Senior");
  const [language, setLanguage] = useState("Tiếng Việt");
  const [modelChoice, setModelChoice] = useState("");
  const [queued, setQueued] = useState(false);
  const {
    data: queueData,
    loading: queueLoading,
    error: queueError,
    refetch: refetchQueue,
  } = useAnalysisQueue(5);
  const queue = queueData ?? [];
  const {
    data: positionsData,
    loading: positionsLoading,
    error: positionsError,
    refetch: refetchPositions,
  } = usePositions();
  const { data: stagesData, loading: stagesLoading } = useStages();
  const { data: levelData } = useLevels();
  const { data: modelsData } = useModels();
  const { data: teamsData } = useTeams();
  const positions = positionsData ?? [];
  const teams = teamsData ?? [];
  const teamOptions = teams.length
    ? teams.map((item) => item.name)
    : [...new Set(positions.map((item) => item.team))];
  const uploadStages = stagesData ?? [];
  const levelOptions = levelData?.length
    ? levelData.map((item) => item.name)
    : [
        "Intern",
        "Fresher",
        "Junior",
        "Middle",
        "Senior",
        "Lead",
        "Principal",
        "Manager",
        "Director",
      ];
  const allModels = modelsData ?? [];
  const activeModels = allModels.filter((item) => item.active);
  const defaultModel =
    activeModels.find((item) => item.apiKeySet) ?? activeModels[0];
  const model = activeModels.some((item) => item.id === modelChoice)
    ? modelChoice
    : (defaultModel?.id ?? "");
  const modelName = (id: string) =>
    allModels.find((item) => item.id === id)?.name ?? id;
  const duplicateModelNames = new Set(
    activeModels
      .filter(
        (item) =>
          activeModels.filter((other) => other.name === item.name).length > 1,
      )
      .map((item) => item.name),
  );
  const modelOptionLabel = (item: (typeof activeModels)[number]) =>
    `${item.name}${duplicateModelNames.has(item.name) ? ` (${item.id})` : ""} · ${item.provider}`;
  const currentPosition = positions.find((item) => item.id === positionId);
  const activeTeam = teamChoice || currentPosition?.team || teamOptions[0] || "";
  const teamPositions = activeTeam
    ? positions.filter((item) => item.team === activeTeam)
    : positions;
  const teamChoices =
    activeTeam && !teamOptions.includes(activeTeam)
      ? [activeTeam, ...teamOptions]
      : teamOptions;
  const position =
    teamPositions.find((item) => item.id === positionId) ?? teamPositions[0];
  const levelValue = levelOptions.includes(level)
    ? level
    : currentPosition?.level && levelOptions.includes(currentPosition.level)
      ? currentPosition.level
      : (levelOptions[0] ?? "");
  const running = phase === "uploading" || phase === "analyzing";
  const isPdf = Boolean(
    file && (file.file.type === "application/pdf" || /\.pdf$/i.test(file.name)),
  );
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    if (!previewUrl) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewUrl]);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!positions.length) return;
    const pool = teamChoice
      ? positions.filter((item) => item.team === teamChoice)
      : positions;
    if (!pool.some((item) => item.id === positionId)) {
      setPositionId(pool[0]?.id ?? "");
    }
  }, [positions, positionId, teamChoice]);

  if ((positionsLoading || stagesLoading) && !positions.length) {
    return (
      <ScreenLoader
        title={t("screen.upload")}
        label={t("upload.loading")}
      />
    );
  }

  if (positionsError) {
    return (
      <div className="screen">
        <PageHead title={t("screen.upload")} />
        <LoadError message={positionsError} onRetry={refetchPositions} />
      </div>
    );
  }

  const closePreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewUrl(null);
  };

  const openPreview = () => {
    if (!file || !isPdf) return;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file.file);
    previewRef.current = url;
    setPreviewUrl(url);
  };

  const pick = (selected: File) => {
    closePreview();
    setQueued(false);
    setResult(null);
    setPhase("idle");
    setError(null);

    const typeOk =
      /\.(pdf|docx)$/i.test(selected.name) ||
      selected.type === "application/pdf" ||
      selected.type === DOCX_MIME;

    if (!typeOk) {
      setFile(null);
      setError(t("upload.error.type"));
      return;
    }
    if (selected.size === 0) {
      setFile(null);
      setError(t("upload.error.empty"));
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFile(null);
      setError(t("upload.error.tooLarge"));
      return;
    }

    setFile({ file: selected, name: selected.name, bytes: selected.size });
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const selected = event.dataTransfer.files?.[0];
    if (selected) pick(selected);
  };

  const start = () => {
    if (!file || running || !position || !model) return;
    const pos = position;

    const form = new FormData();
    form.append("file", file.file);
    form.append("positionId", pos.id);
    form.append("level", levelValue);
    form.append("language", language);
    form.append("model", model);
    form.append("includeQuestions", String(analysis.questions));

    setPhase("uploading");
    setError(null);
    setResult(null);
    setQueued(false);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/analyze-cv`);
    const token = authToken();
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.responseType = "json";
    xhr.timeout = 150_000;

    xhr.upload.onload = () => setPhase("analyzing");

    xhr.onload = () => {
      const body = xhr.response as
        | CvAnalysisResponse
        | AnalyzeCvErrorBody
        | null;

      if (xhr.status === 401) {
        clearSession();
        setPhase("idle");
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300 && body && "analysis" in body) {
        setResult(body);
        setPhase("done");
        setQueued(true);
        void refetchQueue();
        window.setTimeout(() => {
          const reduce = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          resultRef.current?.scrollIntoView({
            behavior: reduce ? "auto" : "smooth",
            block: "start",
          });
        }, 80);
        return;
      }

      setPhase("error");
      setError(
        body && "error" in body
          ? body.error.message
          : t("upload.error.server", { status: xhr.status }),
      );
    };

    xhr.onerror = () => {
      setPhase("error");
      setError(t("upload.error.network"));
    };
    xhr.ontimeout = () => {
      setPhase("error");
      setError(t("upload.error.timeout"));
    };

    xhr.send(form);
  };

  const reset = () => {
    closePreview();
    setFile(null);
    setResult(null);
    setPhase("idle");
    setError(null);
    setQueued(false);
  };

  const downloadJson = () => {
    if (!result) return;
    const slug =
      result.analysis.candidate.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "cv";
    const blob = new Blob(
      [
        JSON.stringify(
          { file: file?.name ?? null, source: "cv", ...result },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `codecv-${slug}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const scrollToResult = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  };

  const fileNote =
    phase === "done" && result
      ? result.meta.pages
        ? t("upload.fileNote.donePages", {
            pages: result.meta.pages,
            count: result.analysis.criteria.length,
          })
        : t("upload.fileNote.done", {
            count: result.analysis.criteria.length,
          })
      : phase === "uploading"
        ? t("upload.fileNote.uploading")
        : phase === "analyzing"
          ? t("upload.fileNote.analyzing")
          : phase === "error"
            ? t("upload.fileNote.error")
            : t("upload.fileNote.idle");

  const criteria = result?.analysis.criteria ?? [];
  const verifiedCount = criteria.filter((item) => item.status === "verified").length;
  const inferredCount = criteria.filter((item) => item.status === "inferred").length;
  const missingCount = criteria.filter((item) => item.status === "missing").length;
  const coveredCount = verifiedCount + inferredCount;
  const languageLabelKey = languageOptions.find(
    (item) => item.value === language,
  )?.labelKey;

  return (
    <div className="screen">
      <PageHead
        title={t("screen.upload")}
        sub={t("upload.sub")}
        actions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => go("candidates")}
          >
            {t("upload.history")}
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        }
      />

      {error ? (
        <div className="callout callout-negative analyze-error" role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <div>
            <p className="callout-title">{t("upload.errorTitle")}</p>
            <p className="callout-body">{error}</p>
          </div>
          {file ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={start}
              disabled={running}
            >
              {t("action.retry")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="upload-grid">
        <section className="card">
          <CardHead
            title={t("upload.uploadCardTitle")}
            meta={t("upload.uploadCardMeta")}
          />
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
                  <FileText size={22} />
                )}
              </span>
              <div className="file-main">
                <span className="file-name">{file.name}</span>
                <span className="file-meta">
                  {formatSize(file.bytes, lang)} · {fileNote}
                </span>
              </div>
              {isPdf ? (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t("upload.previewPdfAria")}
                  onClick={openPreview}
                >
                  <Eye size={16} />
                </button>
              ) : null}
              <button
                type="button"
                className="icon-btn"
                aria-label={t("upload.clearFileAria")}
                disabled={running}
                onClick={reset}
              >
                <X size={16} />
              </button>
            </div>
          ) : null}

          <div
            className={`dropzone${dragging ? " is-drag" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={t("upload.dropAria")}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <UploadCloud size={20} aria-hidden="true" />
            <p className="drop-title">{t("upload.dropTitle")}</p>
            <p className="drop-sub">{t("upload.dropSub")}</p>
          </div>

          <div className="form-stack upload-foot">
            <label className="field">
              <span className="field-label">{t("upload.levelLabel")}</span>
              <select
                value={levelValue}
                onChange={(event) => setLevel(event.target.value)}
              >
                {levelOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <span className="repo-extract-note">
              <GitBranch size={12} aria-hidden="true" /> {t("upload.repoNote")}
            </span>
          </div>

          <div className="upload-foot">
            <span className="foot-note">{t("upload.filePolicy")}</span>
          </div>
        </section>

        <section className="card">
          <CardHead title={t("upload.configTitle")} />
          {queued && result ? (
            <div className="queue-confirm" role="status">
              <Check size={15} aria-hidden="true" />
              <span>
                {t("upload.queuedLead")}
                <strong>{file?.name}</strong>
                {t("upload.queuedTail")}
              </span>
              <button type="button" className="card-link" onClick={scrollToResult}>
                {t("upload.viewResult")}
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <div className="form-stack">
            <label className="field">
              <span className="field-label">{t("upload.teamLabel")}</span>
              <select
                value={activeTeam}
                onChange={(event) => {
                  const team = event.target.value;
                  setTeamChoice(team);
                  setPositionId(
                    positions.find((item) => item.team === team)?.id ?? "",
                  );
                }}
              >
                {teamChoices.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">{t("upload.positionLabel")}</span>
              <select
                value={positionId}
                onChange={(event) => setPositionId(event.target.value)}
              >
                {teamPositions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-grid">
              <label className="field">
                <span className="field-label">{t("upload.languageLabel")}</span>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  {languageOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {t(item.labelKey)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">{t("upload.modelLabel")}</span>
                <select
                  value={model}
                  onChange={(event) => setModelChoice(event.target.value)}
                >
                  {activeModels.length ? (
                    activeModels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {modelOptionLabel(item)}
                      </option>
                    ))
                  ) : (
                    <option value="">{t("upload.noModelOption")}</option>
                  )}
                </select>
              </label>
            </div>

            <div className="switch-stack">
              <div className="switch-row">
                <span className="switch-main">
                  <span className="switch-label">{t("upload.jdLabel")}</span>
                  <span className="switch-sub">{t("upload.jdHint")}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analysis.jd}
                  aria-label={t("upload.jdLabel")}
                  className={`switch${analysis.jd ? " is-on" : ""}`}
                  onClick={() =>
                    setAnalysis((prev) => ({ ...prev, jd: !prev.jd }))
                  }
                >
                  <span />
                </button>
              </div>
              <div className="switch-row">
                <span className="switch-main">
                  <span className="switch-label">
                    {t("upload.questionsLabel")}
                  </span>
                  <span className="switch-sub">
                    {t("upload.questionsHint")}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analysis.questions}
                  aria-label={t("upload.questionsLabel")}
                  className={`switch${analysis.questions ? " is-on" : ""}`}
                  onClick={() =>
                    setAnalysis((prev) => ({
                      ...prev,
                      questions: !prev.questions,
                    }))
                  }
                >
                  <span />
                </button>
              </div>
            </div>

            <div className="stage-preview">
              <span className="stage-preview-label">
                {t("upload.stageCount", { count: uploadStages.length })}
              </span>
              <div className="stage-preview-list">
                {uploadStages.map((stage, index) => (
                  <span className="stage-chip" key={stage.id}>
                    <span className="stage-chip-index num">{index + 1}</span>
                    {stage.label}
                  </span>
                ))}
              </div>
            </div>

            {running ? (
              <div className="analysis-progress" role="status" aria-live="polite">
                <div
                  className={`progress-step${
                    phase === "analyzing" ? " is-done" : " is-current"
                  }`}
                >
                  <span className="progress-marker" aria-hidden="true" />
                  <span className="progress-main">
                    <span className="progress-title">
                      {t("upload.progressUploadTitle")}
                    </span>
                    <span className="progress-detail">
                      {phase === "uploading"
                        ? t("upload.progressUploading")
                        : t("upload.progressReceived")}
                    </span>
                  </span>
                </div>
                <div
                  className={`progress-step${
                    phase === "analyzing" ? " is-current" : " is-pending"
                  }`}
                >
                  <span className="progress-marker" aria-hidden="true" />
                  <span className="progress-main">
                    <span className="progress-title">
                      {t("upload.progressAnalyzeTitle")}
                    </span>
                    <span className="progress-detail">
                      {t("upload.progressAnalyzeDetail", {
                        count: position?.criteria.length ?? 0,
                      })}
                    </span>
                  </span>
                </div>
                <p className="progress-note">{t("upload.progressNote")}</p>
              </div>
            ) : null}

            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!file || running || !model || !position}
              onClick={start}
            >
              {running ? (
                <Loader2 className="spin" size={15} aria-hidden="true" />
              ) : (
                <UploadCloud size={15} aria-hidden="true" />
              )}
              {phase === "uploading"
                ? t("upload.submitUploading")
                : phase === "analyzing"
                  ? t("upload.submitAnalyzing")
                  : t("upload.submit")}
            </button>
            {!file ? (
              <span className="field-hint">{t("upload.hintPick")}</span>
            ) : !model ? (
              <span className="field-hint">{t("upload.hintNoModel")}</span>
            ) : running ? (
              <span className="field-hint">
                {t("upload.hintRunning", { model: modelName(model) })}
              </span>
            ) : (
              <span className="field-hint">
                {languageLabelKey ? t(languageLabelKey) : language} ·{" "}
                {levelValue} · {modelName(model)}
              </span>
            )}
          </div>
        </section>
      </div>

      {result ? (
        <section
          className="card analysis-result"
          ref={resultRef}
          aria-labelledby="analysis-result-title"
        >
          <CardHead
            title={t("upload.resultTitle")}
            meta={t("upload.resultMeta", {
              count: criteria.length,
              model: modelName(result.meta.model),
            })}
            action={
              <div className="result-actions">
                {isPdf ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={openPreview}
                  >
                    <Eye size={14} aria-hidden="true" />
                    {t("upload.viewPdf")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={downloadJson}
                >
                  <Download size={14} aria-hidden="true" />
                  {t("upload.downloadJson")}
                </button>
                <button type="button" className="btn btn-ghost" onClick={reset}>
                  {t("upload.analyzeAnother")}
                </button>
              </div>
            }
          />

          <div className="result-identity">
            <Avatar
              initials={initialsOf(result.analysis.candidate.name)}
              hue={hueOf(result.analysis.candidate.name)}
              size={40}
              name={result.analysis.candidate.name}
            />
            <div className="result-identity-main">
              <div className="result-name-row">
                <h3 id="analysis-result-title">
                  {result.analysis.candidate.name}
                </h3>
                <span className="pill pill-positive">
                  {t("upload.statusAnalyzed")}
                </span>
              </div>
              <p className="result-role">
                {[
                  result.analysis.candidate.currentTitle,
                  result.analysis.candidate.yearsExperience
                    ? t("upload.yearsExperience", {
                        count: result.analysis.candidate.yearsExperience,
                      })
                    : "",
                  result.analysis.candidate.location,
                ]
                  .filter(Boolean)
                  .join(" · ") || t("upload.roleUnknown")}
              </p>
              {result.analysis.candidate.email ||
              result.analysis.candidate.phone ? (
                <p className="result-contact">
                  {[result.analysis.candidate.email, result.analysis.candidate.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
            <span className="result-file mono">{file?.name}</span>
          </div>

          <div className="result-repos">
            <span className="result-repos-label">
              <GitBranch size={13} aria-hidden="true" />
              {t("upload.reposLabel")}
              {result.meta.github.targets > 0 ? (
                <span className="result-repos-meta">
                  {result.meta.github.publicRepos > 0
                    ? t("upload.githubMetaPublic", {
                        analyzed: result.meta.github.analyzed,
                        targets: result.meta.github.targets,
                        public: result.meta.github.publicRepos,
                      })
                    : t("upload.githubMeta", {
                        analyzed: result.meta.github.analyzed,
                        targets: result.meta.github.targets,
                      })}
                </span>
              ) : null}
            </span>
            {result.analysis.repositories.length ? (
              <div className="result-repo-list">
                {result.analysis.repositories.map((repository) => (
                  <a
                    key={repository.url}
                    className={`result-repo is-${repository.status}`}
                    href={repository.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="result-repo-main">
                      <span className="result-repo-label mono">
                        {repository.label}
                      </span>
                      {repository.context ? (
                        <span className="result-repo-context">
                          {repository.context}
                        </span>
                      ) : null}
                      <span className="result-repo-detail">
                        {repository.detail}
                      </span>
                    </span>
                    <span
                      className={`result-repo-status is-${repository.status}`}
                    >
                      {repository.status === "analyzed"
                        ? t("upload.repoRead")
                        : repository.status === "skipped"
                          ? t("upload.repoSkipped")
                          : t("upload.repoUnread")}
                    </span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : (
              <span className="result-repos-empty">
                {t("upload.reposEmpty")}
              </span>
            )}
            {result.meta.repositoryQueue ? (
              <span className="result-repo-queue">
                {t("upload.repoQueued", {
                  count: result.meta.repositoryQueue,
                })}
              </span>
            ) : null}
          </div>

          {result.analysis.summary ? (
            <p className="lede">{result.analysis.summary}</p>
          ) : null}

          <div className="result-evidence">
            <div className="result-evidence-head">
              <span className="health-label">{t("upload.evidenceLabel")}</span>
              <span className="health-value num">
                {coveredCount}/{criteria.length}
              </span>
            </div>
            <EvidenceMeter
              verified={verifiedCount}
              inferred={inferredCount}
              missing={missingCount}
              total={criteria.length}
            />
            <span className="result-evidence-note">
              {t("evidence.legend", {
                verified: verifiedCount,
                inferred: inferredCount,
                missing: missingCount,
              })}
            </span>
          </div>

          <div className="analysis-block">
            <h3 className="mini-title">{t("upload.criteriaTitle")}</h3>
            <ol className="analysis-criteria">
              {criteria.map((criterion) => (
                <li className="analysis-criterion" key={criterion.label}>
                  <div className="analysis-criterion-head">
                    <span className="criterion-label">{criterion.label}</span>
                    <span
                      className={`criterion-kind${criterion.kind === "must" ? " is-must" : ""}`}
                    >
                      {criterion.kind === "must"
                        ? t("upload.criteriaMust")
                        : t("upload.criteriaNice")}
                    </span>
                    <EvidencePill state={criterion.status} />
                  </div>
                  {criterion.quote ? (
                    <blockquote className="analysis-quote">
                      {criterion.quote}
                    </blockquote>
                  ) : null}
                  {criterion.note ? (
                    <p className="criterion-note">{criterion.note}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>

          {result.analysis.strengths.length ||
          result.analysis.gaps.length ? (
            <div className="split-lists result-lists">
              <div className="split-col">
                <h3 className="mini-title">{t("upload.strengthsTitle")}</h3>
                <ul className="plain-list">
                  {result.analysis.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="split-col">
                <h3 className="mini-title">{t("upload.gapsTitle")}</h3>
                <ul className="plain-list is-warn">
                  {result.analysis.gaps.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {result.analysis.questions.length ? (
            <div className="analysis-block">
              <h3 className="mini-title">{t("upload.questionsTitle")}</h3>
              <ol className="analysis-questions">
                {result.analysis.questions.map((item, index) => (
                  <li className="analysis-question" key={`${item.question}-${index}`}>
                    <div className="analysis-question-head">
                      <span className="question-index num">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p>{item.question}</p>
                    </div>
                    {item.rationale ? (
                      <p className="criterion-note">{item.rationale}</p>
                    ) : null}
                    <span className="source-chip">{item.topic}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="card-foot">
            <span className="foot-note">
              <Info size={13} aria-hidden="true" />{" "}
              {t("upload.source", {
                github:
                  result.meta.github.analyzed > 0
                    ? t("upload.source.github", {
                        count: result.meta.github.analyzed,
                      })
                    : "",
                pages: result.meta.pages
                  ? t("upload.source.pages", { count: result.meta.pages })
                  : "",
                characters:
                  result.meta.characters > 0
                    ? t("upload.source.characters", {
                        count: numberFormat(result.meta.characters),
                      })
                    : "",
                model: modelName(result.meta.model),
                seconds: formatSeconds(result.meta.durationMs, lang),
                truncated: result.meta.truncated
                  ? t("upload.source.truncated")
                  : "",
                githubNote:
                  result.meta.github.targets === 0
                    ? t("upload.source.githubAuto")
                    : result.meta.github.analyzed > 0
                      ? t("upload.source.githubPublicNote")
                      : t("upload.source.githubFailed"),
                aiNote: t("upload.source.aiNote"),
              })}
            </span>
          </div>
        </section>
      ) : null}

      <section className="card">
        <CardHead
          title={t("upload.queueTitle")}
          meta={t("upload.queueMeta", { count: queue.length })}
          action={
            <button
              type="button"
              className="card-link"
              onClick={() => go("candidates")}
            >
              {t("upload.allFiles")}
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          }
        />
        {queue.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("upload.colCandidate")}</th>
                  <th>{t("upload.colPosition")}</th>
                  <th>{t("upload.colStage")}</th>
                  <th className="num">{t("upload.colTime")}</th>
                  <th>{t("upload.colStatus")}</th>
                  <th aria-label={t("upload.colOpenAria")} />
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => {
                  const name = item.file || item.candidate;
                  const role = [item.position, item.level]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={item.id}>
                      <td className="c-name">
                        <div className="file-cell">
                          <FileText size={15} aria-hidden="true" />
                          <span className="file-cell-name">{name}</span>
                        </div>
                      </td>
                      <td className="c-role" data-label={t("upload.colPosition")}>
                        {role}
                      </td>
                      <td className="c-stage" data-label={t("upload.colStage")}>
                        <div className="stage-cell">
                          <span>
                            {t("upload.queueStageDone", {
                              count: item.criteria,
                            })}
                          </span>
                        </div>
                      </td>
                      <td
                        className="num c-updated"
                        data-label={t("upload.colTime")}
                      >
                        {relativeTime(item.analyzedAt, t, localeOf(lang))}
                      </td>
                      <td className="c-status" data-label={t("upload.colStatus")}>
                        <span className="pill pill-positive">
                          {t("status.completed")}
                        </span>
                      </td>
                      <td className="c-go">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={t("upload.queueOpenAria", { name })}
                          onClick={() => go("candidate", item.id)}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : queueError ? (
          <LoadError message={queueError} onRetry={refetchQueue} />
        ) : queueLoading ? (
          <Loading label={t("upload.loading")} />
        ) : (
          <EmptyState title={t("upload.queueEmpty")} />
        )}
        <div className="card-foot">
          <span className="foot-note">
            <Info size={13} aria-hidden="true" /> {t("upload.queueNote")}
          </span>
        </div>
      </section>

      {previewUrl && file ? (
        <div className="pdf-modal" role="presentation" onClick={closePreview}>
          <div
            className="pdf-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("upload.previewAria", { name: file.name })}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") closePreview();
            }}
          >
            <div className="pdf-head">
              <span className="pdf-title">
                <FileText size={15} aria-hidden="true" />
                <span>{file.name}</span>
              </span>
              <div className="pdf-actions">
                <a
                  className="icon-btn"
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("upload.openPdfTab")}
                >
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t("upload.closePreview")}
                  autoFocus
                  onClick={closePreview}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="pdf-body">
              <iframe
                className="pdf-frame"
                src={previewUrl}
                title={t("upload.previewAria", { name: file.name })}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
