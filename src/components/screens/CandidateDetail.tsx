"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  MessageSquare,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { Screen } from "@/data/codecv";
import {
  buildHistory,
  candidateEvidence,
  evidenceMeta,
  findingStateMeta,
  generateQuestions,
  getSkills,
  severityMeta,
} from "@/data/codecv";
import { patchCandidate, useCandidate } from "@/lib/api";
import {
  Avatar,
  CardHead,
  CriterionRow,
  EmptyState,
  EvidenceMeter,
  LoadError,
  PageHead,
  ScreenLoader,
  StageLadder,
  StatusPill,
} from "../ui";

type TabKey = "overview" | "evidence" | "repository" | "questions" | "history";

const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Tổng quan" },
  { key: "evidence", label: "Bằng chứng" },
  { key: "repository", label: "Repository" },
  { key: "questions", label: "Câu hỏi" },
  { key: "history", label: "Lịch sử" },
];

export default function CandidateDetail({
  id,
  go,
}: {
  id: string;
  go: (screen: Screen, id?: string) => void;
}) {
  const { data: candidate, loading, error, refetch } = useCandidate(id);
  const overviewRef = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);
  const repoRef = useRef<HTMLDivElement>(null);
  const questionsRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (candidate) {
      setNote(candidate.notes ?? "");
      setNoteSaved(false);
    }
  }, [candidate]);

  if (loading) {
    return <ScreenLoader title="Ứng viên" />;
  }

  if (error) {
    return (
      <div className="screen">
        <PageHead title="Ứng viên" />
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

  const ev = candidateEvidence(candidate);
  const skills = getSkills(candidate);
  const questions = candidate.questions ?? generateQuestions(candidate);
  const history = buildHistory(candidate);
  const findings = candidate.findings ?? [];
  const missing = candidate.criteria.filter((item) => item.state === "missing");

  const jump = (key: TabKey, ref: RefObject<HTMLDivElement | null>) => {
    setTab(key);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  };

  const saveNote = async () => {
    if (!candidate || !note.trim()) return;
    setSaving(true);
    try {
      await patchCandidate(candidate.id, { notes: note });
      setNoteSaved(true);
    } catch {
      setNoteSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const exportReport = () => {
    const lines = [
      `# CodeCV AI — Báo cáo ứng viên`,
      ``,
      `**${candidate.name}** · ${candidate.position} · ${candidate.level}`,
      `${candidate.email} · ${candidate.phone} · ${candidate.location}`,
      ``,
      `## Tóm tắt`,
      candidate.summary,
      ``,
      `## Bảng bằng chứng (${ev.covered}/${ev.total} tiêu chí có bằng chứng)`,
      ...candidate.criteria.map(
        (item) =>
          `- [${evidenceMeta[item.state].label}] ${item.label} — ${item.evidence} bằng chứng · ${item.note}`,
      ),
      ``,
      `## Điểm mạnh`,
      ...candidate.strengths.map((item) => `- ${item}`),
      ``,
      `## Cần xác minh`,
      ...candidate.verify.map((item) => `- ${item}`),
      ``,
      `## Ghi chú của reviewer`,
      note.trim() || "Chưa có ghi chú.",
      ``,
      `Nguồn: ${candidate.source}${candidate.repo ? ` · ${candidate.repo}@${candidate.commit}` : ""}`,
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CodeCV_${candidate.id}_v3.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="screen">
      <button
        type="button"
        className="back-link"
        onClick={() => go("candidates")}
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Danh sách ứng viên
      </button>

      <PageHead
        title={candidate.name}
        sub={`${candidate.role} · ${candidate.years} năm kinh nghiệm · ${candidate.location} · ${candidate.email}`}
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={exportReport}
            >
              <Download size={15} aria-hidden="true" />
              Xuất báo cáo
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={candidate.status === "failed"}
              onClick={() => go("interview", candidate.id)}
            >
              <MessageSquare size={15} aria-hidden="true" />
              Chuyển sang phỏng vấn
            </button>
          </>
        }
      />

      <div className="detail-toolbar">
        <div className="detail-person">
          <Avatar
            initials={candidate.initials}
            hue={candidate.hue}
            size={40}
            name={candidate.name}
          />
          <div className="detail-person-main">
            <span className="detail-person-row">
              <StatusPill status={candidate.status} />
              <span className="level-tag">{candidate.level}</span>
              <span className="dot-sep" aria-hidden="true" />
              <span className="muted">Nguồn: {candidate.source}</span>
            </span>
            <span className="detail-person-sub">
              Người review {candidate.reviewer ?? "—"} · cập nhật {candidate.updated}
            </span>
          </div>
        </div>
        <div className="detail-health">
          <span className="health-label">Bằng chứng</span>
          <span className="health-value num">
            {ev.covered}/{ev.total}
          </span>
          <EvidenceMeter
            verified={ev.verified}
            inferred={ev.inferred}
            missing={ev.missing}
            total={ev.total}
          />
        </div>
      </div>

      <nav className="detail-tabs" aria-label="Các phần của hồ sơ">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`detail-tab${tab === item.key ? " is-on" : ""}`}
            aria-current={tab === item.key ? "true" : undefined}
            onClick={() => {
              const map = {
                overview: overviewRef,
                evidence: evidenceRef,
                repository: repoRef,
                questions: questionsRef,
                history: historyRef,
              };
              jump(item.key, map[item.key]);
            }}
          >
            {item.label}
            {item.key === "evidence" ? (
              <span className="tab-count num">{ev.total}</span>
            ) : null}
            {item.key === "questions" ? (
              <span className="tab-count num">{questions.length}</span>
            ) : null}
          </button>
        ))}
        <span className="tabs-meta">Báo cáo v3 · {candidate.updatedAt}</span>
      </nav>

      <div className="detail-grid">
        <div className="detail-main">
          {candidate.status === "failed" ? (
            <div className="callout callout-negative" role="status">
              <ShieldAlert size={17} aria-hidden="true" />
              <div>
                <p className="callout-title">Repository chưa truy cập được</p>
                <p className="callout-body">
                  Báo cáo mới dựa trên CV. Cấp lại quyền repository để phân tích
                  mã nguồn và tạo bằng chứng đầy đủ.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => go("upload")}
              >
                Phân tích lại
              </button>
            </div>
          ) : null}

          {candidate.status === "processing" ? (
            <div className="callout" role="status">
              <Sparkles size={17} aria-hidden="true" />
              <div className="callout-grow">
                <p className="callout-title">Đang phân tích hồ sơ</p>
                <p className="callout-body">
                  Bằng chứng bên dưới là kết quả tạm thời và sẽ được cập nhật khi
                  hoàn tất.
                </p>
                <StageLadder step={candidate.stageIndex ?? 1} />
              </div>
            </div>
          ) : null}

          <section
            className="card anchor-section"
            ref={overviewRef}
            aria-labelledby="overview-title"
          >
            <CardHead
              title="Tóm tắt của CodeCV"
              meta={`${ev.verified} đã xác minh · ${ev.inferred} suy luận · ${ev.missing} chưa đủ`}
            />
            <div className="overview-body">
              <p className="lede">{candidate.summary.split(". ")[0]}.</p>
              <div className="split-lists">
                <div className="split-col">
                  <h3 className="mini-title">Điểm mạnh có bằng chứng</h3>
                  <ul className="plain-list">
                    {candidate.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="split-col">
                  <h3 className="mini-title">Cần xác minh</h3>
                  <ul className="plain-list is-warn">
                    {candidate.verify.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section
            className="card anchor-section"
            ref={evidenceRef}
            id="evidence"
            aria-labelledby="evidence-title"
          >
            <CardHead
              title="Bảng bằng chứng"
              meta={`${ev.total} tiêu chí · ${ev.missing} cần xác minh`}
              action={
                <span className="legend-inline">
                  <span className="legend-dot is-verified" />
                  Đã xác minh
                  <span className="legend-dot is-inferred" />
                  Suy luận
                  <span className="legend-dot is-missing" />
                  Chưa đủ
                </span>
              }
            />
            <div className="criterion-head">
              <span>Tiêu chí & nguồn</span>
              <span>Trạng thái</span>
              <span className="num">Bằng chứng</span>
            </div>
            <div className="criterion-list">
              {candidate.criteria.map((item) => (
                <CriterionRow key={item.id} item={item} />
              ))}
            </div>
            <div className="card-foot">
              <span className="foot-note">
                Mỗi tiêu chí chỉ được coi là đã xác minh khi có nguồn cụ thể từ
                CV, repository hoặc phỏng vấn.
              </span>
              <button
                type="button"
                className="card-link"
                onClick={() => jump("repository", repoRef)}
              >
                Xem phát hiện repository
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
          </section>

          <section
            className="card anchor-section"
            ref={repoRef}
            aria-labelledby="repo-title"
          >
            <CardHead
              title="Phát hiện từ repository"
              meta={
                candidate.repo
                  ? `${candidate.repo} · ${candidate.commit ?? "—"} · ${findings.length} phát hiện`
                  : "Chưa kết nối repository"
              }
              action={
                candidate.repo ? (
                  <button
                    type="button"
                    className="card-link"
                    onClick={() => go("repository", candidate.id)}
                  >
                    Mở phân tích
                    <ChevronRight size={13} aria-hidden="true" />
                  </button>
                ) : null
              }
            />
            {findings.length ? (
              <div className="finding-list">
                {findings.slice(0, 3).map((finding) => (
                  <div className="finding-row" key={finding.id}>
                    <span
                      className={`sev-dot ${severityMeta[finding.severity].className}`}
                      aria-label={`Mức ${severityMeta[finding.severity].label}`}
                      title={`Mức ${severityMeta[finding.severity].label}`}
                    />
                    <div className="finding-main">
                      <div className="finding-title-row">
                        <span className="finding-title">{finding.title}</span>
                        <span className={`pill ${findingStateMeta[finding.state].className}`}>
                          {findingStateMeta[finding.state].label}
                        </span>
                      </div>
                      <span className="finding-loc">
                        {finding.module} · {finding.file}:{finding.line}
                      </span>
                      <p className="finding-why">{finding.rationale}</p>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Mở phát hiện ${finding.title}`}
                      onClick={() => go("repository", candidate.id)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Chưa có phát hiện repository"
                detail="Kết nối repository công khai để đối chiếu code với tiêu chí tuyển dụng."
                action={
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => go("upload")}
                  >
                    Kết nối repository
                  </button>
                }
              />
            )}
            {findings.length > 3 ? (
              <div className="card-foot">
                <span className="foot-note">
                  Còn {findings.length - 3} phát hiện khác trong phân tích đầy đủ.
                </span>
              </div>
            ) : null}
          </section>

          <section
            className="card anchor-section"
            ref={questionsRef}
            aria-labelledby="questions-title"
          >
            <CardHead
              title="Câu hỏi phỏng vấn"
              meta={`${questions.length} câu · bám theo bằng chứng`}
              action={
                <button
                  type="button"
                  className="card-link"
                  onClick={() => go("interview", candidate.id)}
                >
                  Mở Interview Studio
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
              }
            />
            <div className="question-list">
              {questions.slice(0, 3).map((question, index) => (
                <div className="question-row" key={question.id}>
                  <span className="q-index num">{index + 1}</span>
                  <div className="q-main">
                    <div className="q-meta">
                      <span className="pill pill-neutral">{question.category}</span>
                      <span className="pill pill-neutral">{question.difficulty}</span>
                    </div>
                    <p className="q-text">{question.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="card-foot">
              <span className="foot-note">
                {questions.length - 3 > 0
                  ? `Còn ${questions.length - 3} câu hỏi và hướng dẫn đáp án trong Interview Studio.`
                  : "Toàn bộ câu hỏi đã hiển thị."}
              </span>
            </div>
          </section>

          <section
            className="card anchor-section"
            ref={historyRef}
            aria-labelledby="history-title"
          >
            <CardHead title="Lịch sử hồ sơ" meta={`${history.length} sự kiện`} />
            <ol className="timeline timeline-wide">
              {history.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  <span className="tl-dot" aria-hidden="true" />
                  <div className="tl-main">
                    <span className="tl-time">{event.at}</span>
                    <span className="tl-title">{event.title}</span>
                    <span className="tl-detail">{event.detail}</span>
                    <span className="tl-actor">{event.actor}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="detail-rail">
          <section className="card">
            <CardHead title="Thông tin hồ sơ" />
            <dl className="info-list">
              <div>
                <dt>Vị trí</dt>
                <dd>{candidate.position}</dd>
              </div>
              <div>
                <dt>Kinh nghiệm</dt>
                <dd>{candidate.years} năm</dd>
              </div>
              <div>
                <dt>Địa điểm</dt>
                <dd>{candidate.location}</dd>
              </div>
              <div>
                <dt>Nguồn</dt>
                <dd>{candidate.source}</dd>
              </div>
              <div>
                <dt>Người review</dt>
                <dd>{candidate.reviewer ?? "Chưa chỉ định"}</dd>
              </div>
              <div>
                <dt>Ngày tạo</dt>
                <dd className="num">{candidate.createdAt}</dd>
              </div>
              <div>
                <dt>Liên hệ</dt>
                <dd className="num">{candidate.phone}</dd>
              </div>
            </dl>
          </section>

          <section className="card">
            <CardHead title="Kỹ năng & độ tin cậy" meta={`${skills.length} kỹ năng`} />
            <div className="skill-list">
              {skills.slice(0, 7).map((skill) => (
                <div className="skill-row" key={skill.name}>
                  <div className="skill-main">
                    <span className="skill-name">{skill.name}</span>
                    <span className="skill-src">{skill.source}</span>
                  </div>
                  <div className="skill-side">
                    <span className="skill-level">{skill.level}</span>
                    <span className="skill-confidence">
                      <span
                        className={`legend-dot ${
                          skill.state === "verified"
                            ? "is-verified"
                            : skill.state === "inferred"
                              ? "is-inferred"
                              : "is-missing"
                        }`}
                      />
                      {skill.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="card-foot">
              <span className="foot-note">
                {missing.length} tiêu chí chưa đủ dữ liệu; không suy đoán thay
                bằng chứng.
              </span>
            </div>
          </section>

          <section className="card">
            <CardHead title="Ghi chú reviewer" />
            <textarea
              className="note-input"
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setNoteSaved(false);
              }}
              rows={4}
              placeholder="Ghi lại điều cần kiểm tra hoặc ấn tượng ban đầu…"
              aria-label="Ghi chú reviewer"
            />
            <div className="note-foot">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!note.trim() || saving}
                onClick={saveNote}
              >
                {saving ? "Đang lưu…" : "Lưu ghi chú"}
              </button>
              {noteSaved ? (
                <span className="save-state" role="status">
                  Đã lưu trong workspace
                </span>
              ) : (
                <span className="foot-note">Chỉ hiển thị với người review.</span>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
