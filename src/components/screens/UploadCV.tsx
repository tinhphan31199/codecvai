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
import { useLevels, usePositions, useStages } from "@/lib/api";
import {
  ANALYSIS_MODELS,
  MAX_FILE_BYTES,
  modelLabel,
  type AnalyzeCvErrorBody,
  type CvAnalysisResponse,
} from "@/lib/cv-analysis";
import {
  Avatar,
  CardHead,
  EvidenceMeter,
  EvidencePill,
  LoadError,
  PageHead,
  ScreenLoader,
  StageLadder,
} from "../ui";

type PickedFile = {
  file: File;
  name: string;
  size: string;
};

type Phase = "idle" | "uploading" | "analyzing" | "done" | "error";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

const formatSize = (bytes: number) => {
  const kb = bytes / 1024;
  const value = kb < 1000 ? kb : kb / 1024;
  const unit = kb < 1000 ? "KB" : "MB";
  const digits = value >= 100 ? 0 : 1;
  return `${value.toFixed(digits).replace(".", ",")} ${unit}`;
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

type QueueItem = {
  key: string;
  name: string;
  role: string;
  stage: string;
  step: number;
  time: string;
  state: "done" | "running" | "queued";
};

const initialQueue: QueueItem[] = [
  {
    key: "an",
    name: "Pham_Minh_An_CV.pdf",
    role: "Senior Backend Engineer",
    stage: "Hoàn tất · 8 tiêu chí",
    step: 6,
    time: "2 phút trước",
    state: "done",
  },
  {
    key: "minh",
    name: "Le_Hoang_Minh_CV.pdf",
    role: "Backend Engineer",
    stage: "Đang trích xuất bằng chứng",
    step: 3,
    time: "4 phút trước",
    state: "running",
  },
  {
    key: "ha",
    name: "Nguyen_Thu_Ha_CV.pdf",
    role: "Product Designer",
    stage: "Hoàn tất · 6 tiêu chí",
    step: 6,
    time: "Hôm qua",
    state: "done",
  },
];

export default function UploadCV({
  go,
}: {
  go: (screen: Screen, id?: string) => void;
}) {
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
  const [level, setLevel] = useState("Senior");
  const [language, setLanguage] = useState("Tiếng Việt");
  const [model, setModel] = useState("gemini-3.5-flash-lite");
  const [queued, setQueued] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue);
  const {
    data: positionsData,
    loading: positionsLoading,
    error: positionsError,
    refetch: refetchPositions,
  } = usePositions();
  const { data: stagesData, loading: stagesLoading } = useStages();
  const { data: levelData } = useLevels();
  const positions = positionsData ?? [];
  const uploadStages = stagesData ?? [];
  const levelOptions = levelData?.length
    ? levelData.map((item) => item.name)
    : ["Junior", "Middle", "Senior"];
  const levelChoices = levelOptions.includes(level)
    ? levelOptions
    : [level, ...levelOptions];
  const position = positions.find((item) => item.id === positionId) ?? positions[0];
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
    if (!positions.some((item) => item.id === positionId)) {
      setPositionId(positions[0].id);
    }
  }, [positions, positionId]);

  if ((positionsLoading || stagesLoading) && !positions.length) {
    return (
      <ScreenLoader
        title="CV Analysis"
        label="Đang tải vị trí và công đoạn phân tích…"
      />
    );
  }

  if (positionsError) {
    return (
      <div className="screen">
        <PageHead title="CV Analysis" />
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

  const clearLiveQueue = () =>
    setQueue((prev) => prev.filter((item) => !item.key.startsWith("live-")));

  const pick = (selected: File) => {
    closePreview();
    setQueued(false);
    setResult(null);
    setPhase("idle");
    setError(null);
    clearLiveQueue();

    const typeOk =
      /\.(pdf|docx)$/i.test(selected.name) ||
      selected.type === "application/pdf" ||
      selected.type === DOCX_MIME;

    if (!typeOk) {
      setFile(null);
      setError("Chỉ hỗ trợ CV định dạng PDF hoặc DOCX. Chọn tệp khác.");
      return;
    }
    if (selected.size === 0) {
      setFile(null);
      setError("Tệp rỗng. Chọn tệp khác.");
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFile(null);
      setError("Tệp vượt quá 10 MB. Nén hoặc xuất lại CV rồi thử lại.");
      return;
    }

    setFile({ file: selected, name: selected.name, size: formatSize(selected.size) });
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const selected = event.dataTransfer.files?.[0];
    if (selected) pick(selected);
  };

  const start = () => {
    if (!file || running || !position) return;
    const pos = position;

    const form = new FormData();
    form.append("file", file.file);
    form.append("positionId", pos.id);
    form.append("level", level);
    form.append("language", language);
    form.append("model", model);
    form.append("includeQuestions", String(analysis.questions));

    setPhase("uploading");
    setError(null);
    setResult(null);
    setQueued(false);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/analyze-cv`);
    xhr.responseType = "json";
    xhr.timeout = 150_000;

    xhr.upload.onload = () => setPhase("analyzing");

    xhr.onload = () => {
      const body = xhr.response as
        | CvAnalysisResponse
        | AnalyzeCvErrorBody
        | null;

      if (xhr.status >= 200 && xhr.status < 300 && body && "analysis" in body) {
        setResult(body);
        setPhase("done");
        setQueued(true);
        setQueue((prev) => [
          {
            key: `live-${Date.now()}`,
            name: file.name,
            role: `${pos.title} · ${level}`,
            stage: `Hoàn tất · ${body.analysis.criteria.length} tiêu chí`,
            step: 6,
            time: "Vừa xong",
            state: "done",
          },
          ...prev.filter((item) => !item.key.startsWith("live-")),
        ]);
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
          : `Máy chủ trả lời lỗi ${xhr.status}. Thử lại sau.`,
      );
    };

    xhr.onerror = () => {
      setPhase("error");
      setError(
        "Không kết nối được máy chủ phân tích. Kiểm tra kết nối mạng rồi thử lại.",
      );
    };
    xhr.ontimeout = () => {
      setPhase("error");
      setError(
        "Phân tích vượt quá 150 giây. Thử lại hoặc dùng Gemini 3.1 Flash Lite.",
      );
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
    clearLiveQueue();
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
      ? `${result.meta.pages ? `${result.meta.pages} trang · ` : ""}${result.analysis.criteria.length} tiêu chí đã đối chiếu`
      : phase === "uploading"
        ? "đang tải lên máy chủ"
        : phase === "analyzing"
          ? "đang phân tích bằng Gemini"
          : phase === "error"
            ? "phân tích chưa hoàn tất"
            : "sẵn sàng phân tích";

  const criteria = result?.analysis.criteria ?? [];
  const verifiedCount = criteria.filter((item) => item.status === "verified").length;
  const inferredCount = criteria.filter((item) => item.status === "inferred").length;
  const missingCount = criteria.filter((item) => item.status === "missing").length;
  const coveredCount = verifiedCount + inferredCount;

  return (
    <div className="screen">
      <PageHead
        title="CV Analysis"
        sub="Tải CV, đối chiếu với mô tả công việc và tạo bằng chứng có thể kiểm chứng."
        actions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => go("candidates")}
          >
            Lịch sử phân tích
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        }
      />

      {error ? (
        <div className="callout callout-negative analyze-error" role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <div>
            <p className="callout-title">Không thể phân tích CV</p>
            <p className="callout-body">{error}</p>
          </div>
          {file ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={start}
              disabled={running}
            >
              Thử lại
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="upload-grid">
        <section className="card">
          <CardHead title="Tải hồ sơ" meta="PDF, DOCX · tối đa 10 MB" />
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
                  {file.size} · {fileNote}
                </span>
              </div>
              {isPdf ? (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Xem trước PDF"
                  onClick={openPreview}
                >
                  <Eye size={16} />
                </button>
              ) : null}
              <button
                type="button"
                className="icon-btn"
                aria-label="Bỏ file đã chọn"
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
            aria-label="Chọn hoặc kéo thả file CV"
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
            <p className="drop-title">Kéo thả CV vào đây</p>
            <p className="drop-sub">
              hoặc chọn file từ máy · PDF, DOCX · tối đa 10 MB
            </p>
          </div>

          <div className="form-stack upload-foot">
            <label className="field">
              <span className="field-label">Cấp bậc đánh giá</span>
              <select
                value={level}
                onChange={(event) => setLevel(event.target.value)}
              >
                {levelChoices.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <span className="repo-extract-note">
              <GitBranch size={12} aria-hidden="true" /> Link GitHub trong CV
              được đọc qua GitHub API: repo công khai sẽ phân tích mã nguồn, hồ
              sơ cá nhân sẽ quét toàn bộ repo công khai.
            </span>
          </div>

          <div className="upload-foot">
            <span className="foot-note">
              File được lưu trong workspace Product Engineering và chỉ dùng để
              đánh giá tuyển dụng.
            </span>
          </div>
        </section>

        <section className="card">
          <CardHead title="Cấu hình phân tích" />
          {queued && result ? (
            <div className="queue-confirm" role="status">
              <Check size={15} aria-hidden="true" />
              <span>
                Đã phân tích <strong>{file?.name}</strong>.
              </span>
              <button type="button" className="card-link" onClick={scrollToResult}>
                Xem kết quả
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <div className="form-stack">
            <label className="field">
              <span className="field-label">Vị trí đối chiếu</span>
              <select
                value={positionId}
                onChange={(event) => setPositionId(event.target.value)}
              >
                {positions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-grid">
              <label className="field">
                <span className="field-label">Ngôn ngữ đánh giá</span>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option>Tiếng Việt</option>
                  <option>English</option>
                </select>
              </label>

              <label className="field">
                <span className="field-label">Model phân tích</span>
                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                >
                  {ANALYSIS_MODELS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="switch-stack">
              <div className="switch-row">
                <span className="switch-main">
                  <span className="switch-label">Đối chiếu với JD</span>
                  <span className="switch-sub">
                    Chỉ ra tiêu chí đáp ứng và phần còn thiếu.
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analysis.jd}
                  aria-label="Đối chiếu với JD"
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
                  <span className="switch-label">Tạo câu hỏi phỏng vấn</span>
                  <span className="switch-sub">
                    Câu hỏi bám theo bằng chứng, không hỏi chung chung.
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analysis.questions}
                  aria-label="Tạo câu hỏi phỏng vấn"
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
                {uploadStages.length} công đoạn phân tích
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
                    <span className="progress-title">Tải hồ sơ</span>
                    <span className="progress-detail">
                      {phase === "uploading"
                        ? "Đang gửi tệp lên máy chủ"
                        : "Đã nhận tệp"}
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
                    <span className="progress-title">Phân tích với Gemini</span>
                    <span className="progress-detail">
                      Trích xuất nội dung và đối chiếu{" "}
                      {position?.criteria.length ?? 0} tiêu chí
                    </span>
                  </span>
                </div>
                <p className="progress-note">
                  Không hiển thị phần trăm ước lượng; thời gian phụ thuộc độ dài
                  CV và model.
                </p>
              </div>
            ) : null}

            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!file || running}
              onClick={start}
            >
              {running ? (
                <Loader2 className="spin" size={15} aria-hidden="true" />
              ) : (
                <UploadCloud size={15} aria-hidden="true" />
              )}
              {phase === "uploading"
                ? "Đang tải CV…"
                : phase === "analyzing"
                  ? "Gemini đang phân tích…"
                  : "Bắt đầu phân tích"}
            </button>
            {!file ? (
              <span className="field-hint">Chọn một CV để bắt đầu.</span>
            ) : running ? (
              <span className="field-hint">
                Đang xử lý với {modelLabel(model)}. Không đóng tab.
              </span>
            ) : (
              <span className="field-hint">
                {language} · {level} · {modelLabel(model)}
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
            title="Kết quả phân tích"
            meta={`${criteria.length} tiêu chí · ${modelLabel(result.meta.model)}`}
            action={
              <div className="result-actions">
                {isPdf ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={openPreview}
                  >
                    <Eye size={14} aria-hidden="true" />
                    Xem PDF
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={downloadJson}
                >
                  <Download size={14} aria-hidden="true" />
                  Tải JSON
                </button>
                <button type="button" className="btn btn-ghost" onClick={reset}>
                  Phân tích CV khác
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
                <span className="pill pill-positive">Đã phân tích</span>
              </div>
              <p className="result-role">
                {[
                  result.analysis.candidate.currentTitle,
                  result.analysis.candidate.yearsExperience
                    ? `${result.analysis.candidate.yearsExperience} năm kinh nghiệm`
                    : "",
                  result.analysis.candidate.location,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Chưa nhận diện được vị trí hiện tại"}
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
              Repository &amp; GitHub
              {result.meta.github.targets > 0 ? (
                <span className="result-repos-meta">
                  Đã đọc {result.meta.github.analyzed}/
                  {result.meta.github.targets} mục GitHub
                  {result.meta.github.publicRepos > 0
                    ? ` · ${result.meta.github.publicRepos} repo công khai`
                    : ""}
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
                        ? "Đã đọc"
                        : repository.status === "skipped"
                          ? "Bỏ qua"
                          : "Chưa đọc"}
                    </span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ))}
              </div>
            ) : (
              <span className="result-repos-empty">
                CV không đề cập repository công khai.
              </span>
            )}
          </div>

          {result.analysis.summary ? (
            <p className="lede">{result.analysis.summary}</p>
          ) : null}

          <div className="result-evidence">
            <div className="result-evidence-head">
              <span className="health-label">Bằng chứng</span>
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
              {verifiedCount} đã xác minh · {inferredCount} suy luận ·{" "}
              {missingCount} chưa đủ
            </span>
          </div>

          <div className="analysis-block">
            <h3 className="mini-title">Đối chiếu tiêu chí</h3>
            <ol className="analysis-criteria">
              {criteria.map((criterion) => (
                <li className="analysis-criterion" key={criterion.label}>
                  <div className="analysis-criterion-head">
                    <span className="criterion-label">{criterion.label}</span>
                    <span
                      className={`criterion-kind${criterion.kind === "must" ? " is-must" : ""}`}
                    >
                      {criterion.kind === "must" ? "Bắt buộc" : "Ưu tiên"}
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
                <h3 className="mini-title">Điểm mạnh có bằng chứng</h3>
                <ul className="plain-list">
                  {result.analysis.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="split-col">
                <h3 className="mini-title">Cần xác minh</h3>
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
              <h3 className="mini-title">Câu hỏi phỏng vấn gợi ý</h3>
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
              <Info size={13} aria-hidden="true" /> Nguồn: nội dung CV
              {result.meta.github.analyzed > 0
                ? ` + ${result.meta.github.analyzed} mục GitHub công khai`
                : ""}
              {result.meta.pages ? ` · ${result.meta.pages} trang` : ""}
              {result.meta.characters > 0
                ? ` · ${result.meta.characters.toLocaleString("vi-VN")} ký tự`
                : ""}{" "}
              · {modelLabel(result.meta.model)} ·{" "}
              {(result.meta.durationMs / 1000).toFixed(1)} giây
              {result.meta.truncated ? " · CV đã được rút gọn" : ""}.{" "}
              {result.meta.github.targets === 0
                ? "Repository được trích tự động từ CV."
                : result.meta.github.analyzed > 0
                  ? "GitHub chỉ đọc dữ liệu công khai và có thể chậm hơn CV."
                  : "Chưa đọc được dữ liệu GitHub; kết quả dựa trên CV."}{" "}
              Kết quả do AI tạo; cần đối chiếu với CV gốc trước khi quyết định.
            </span>
          </div>
        </section>
      ) : null}

      <section className="card">
        <CardHead
          title="Hàng đợi phân tích"
          meta={`${queue.length} hồ sơ gần đây`}
          action={
            <button
              type="button"
              className="card-link"
              onClick={() => go("candidates")}
            >
              Tất cả hồ sơ
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          }
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Hồ sơ</th>
                <th>Vị trí</th>
                <th>Công đoạn</th>
                <th className="num">Thời gian</th>
                <th>Trạng thái</th>
                <th aria-label="Mở hồ sơ" />
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.key}>
                  <td className="c-name">
                    <div className="file-cell">
                      <FileText size={15} aria-hidden="true" />
                      <span className="file-cell-name">{item.name}</span>
                    </div>
                  </td>
                  <td className="c-role" data-label="Vị trí">
                    {item.role}
                  </td>
                  <td className="c-stage" data-label="Công đoạn">
                    <div className="stage-cell">
                      <span>{item.stage}</span>
                      {item.state === "running" ? (
                        <StageLadder step={item.step} labels={false} />
                      ) : null}
                    </div>
                  </td>
                  <td className="num c-updated" data-label="Thời gian">
                    {item.time}
                  </td>
                  <td className="c-status" data-label="Trạng thái">
                    <span
                      className={`pill ${
                        item.state === "done"
                          ? "pill-positive"
                          : item.state === "running"
                            ? "pill-info"
                            : "pill-neutral"
                      }`}
                    >
                      {item.state === "done"
                        ? "Hoàn tất"
                        : item.state === "running"
                          ? "Đang phân tích"
                          : "Chờ xử lý"}
                    </span>
                  </td>
                  <td className="c-go">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Mở ${item.name}`}
                      onClick={() => {
                        if (item.key.startsWith("live-")) {
                          scrollToResult();
                          return;
                        }
                        go(
                          "candidate",
                          item.key === "ha"
                            ? "ha"
                            : item.key === "minh"
                              ? "minh"
                              : "an",
                        );
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <span className="foot-note">
            <Info size={13} aria-hidden="true" /> Phân tích gồm 6 công đoạn: đọc
            CV, trích xuất kỹ năng, đọc GitHub công khai, đối chiếu JD, đánh giá
            bằng chứng, tạo câu hỏi.
          </span>
        </div>
      </section>

      {previewUrl && file ? (
        <div className="pdf-modal" role="presentation" onClick={closePreview}>
          <div
            className="pdf-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Xem trước ${file.name}`}
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
                  aria-label="Mở PDF trong tab mới"
                >
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Đóng xem trước"
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
                title={`Xem trước ${file.name}`}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
