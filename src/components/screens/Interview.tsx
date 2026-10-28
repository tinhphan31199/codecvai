"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock,
  Download,
  MessageSquare,
  Video,
} from "lucide-react";
import type { Question, Screen } from "@/data/codecv";
import { buildHistory, generateQuestions } from "@/data/codecv";
import { useCandidate } from "@/lib/api";
import {
  Avatar,
  CardHead,
  EmptyState,
  LoadError,
  PageHead,
  ScreenLoader,
} from "../ui";

const categories = [
  "Architecture",
  "Database",
  "Messaging",
  "Security",
  "Testing",
] as const;

type AnswerTab = "hints" | "sample" | "checks";

const checkPoints = [
  "Nêu bối cảnh và ràng buộc cụ thể từ repository.",
  "Chỉ ra trade-off và phương án thay thế đã cân nhắc.",
  "Mô tả cách kiểm chứng hoặc đo kết quả sau khi làm.",
];

const hintPrompts = [
  "Bắt đầu bằng một tình huống thật trong repository, không trả lời lý thuyết.",
  "Đào vào quyết định: vì sao chọn cách này, đánh đổi điều gì.",
  "Hỏi tiếp nếu câu trả lời dừng ở khái niệm hoặc không có ví dụ.",
];

export default function InterviewStudio({
  id,
  go,
}: {
  id: string;
  go: (screen: Screen, id?: string) => void;
}) {
  const { data: candidate, loading, error, refetch } = useCandidate(id);
  const questions = useMemo(
    () => (candidate ? candidate.questions ?? generateQuestions(candidate) : []),
    [candidate],
  );
  const [selectedId, setSelectedId] = useState(questions[0]?.id ?? "");
  const [tab, setTab] = useState<AnswerTab>("hints");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [asked, setAsked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedNotes, setSavedNotes] = useState<Record<string, boolean>>({});

  if (loading) {
    return <ScreenLoader title="Interview Studio" />;
  }

  if (error) {
    return (
      <div className="screen">
        <PageHead title="Interview Studio" />
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

  const selected: Question | undefined =
    questions.find((item) => item.id === selectedId) ?? questions[0];

  const grouped = categories
    .map((category) => ({
      category,
      items: questions.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length);

  const ratedCount = Object.keys(ratings).length;
  const askedCount = Object.keys(asked).filter((key) => asked[key]).length;

  const toggleRating = (criterionId: string, value: number) => {
    setRatings((prev) => {
      const next = { ...prev };
      if (next[criterionId] === value) delete next[criterionId];
      else next[criterionId] = value;
      return next;
    });
  };

  const exportSheet = () => {
    const lines = [
      "# Phiếu phỏng vấn — CodeCV AI",
      "",
      `**${candidate.name}** · ${candidate.position}`,
      `Người phỏng vấn: Minh Anh · Vòng 2 · 26/10/2026 · 15:00`,
      "",
      "## Rubric (0–4)",
      ...candidate.criteria.map(
        (item) =>
          `- ${item.label}: ${ratings[item.id] ?? "chưa chấm"}/4`,
      ),
      "",
      "## Câu hỏi đã hỏi",
      ...questions
        .filter((item) => asked[item.id])
        .map((item, index) => `${index + 1}. ${item.text}`),
      "",
      "## Ghi chú",
      ...(Object.keys(notes).some((key) => notes[key]?.trim())
        ? questions
            .filter((item) => notes[item.id]?.trim())
            .map(
              (item) =>
                `- Câu ${questions.indexOf(item) + 1}: ${notes[item.id]}`,
            )
        : ["Chưa có ghi chú."]),
      "",
      `Lịch sử hồ sơ gần nhất: ${buildHistory(candidate)[0]?.title ?? "—"}`,
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CodeCV_interview_${candidate.id}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="screen">
      <PageHead
        title="Interview Studio"
        sub={`${candidate.name} · ${candidate.position} · Vòng 2 · ${questions.length} câu hỏi · 60 phút`}
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => go("candidate", candidate.id)}
            >
              Mở hồ sơ
            </button>
            <button type="button" className="btn btn-primary" onClick={exportSheet}>
              <Download size={15} aria-hidden="true" />
              Xuất phiếu phỏng vấn
            </button>
          </>
        }
      />

      <div className="studio-strip">
        <div className="studio-person">
          <Avatar
            initials={candidate.initials}
            hue={candidate.hue}
            size={38}
            name={candidate.name}
          />
          <div>
            <span className="studio-name">{candidate.name}</span>
            <span className="studio-sub">
              {candidate.role} · {candidate.years} năm · {candidate.location}
            </span>
          </div>
        </div>
        <div className="studio-meta">
          <span>
            <Clock size={14} aria-hidden="true" />
            60 phút
          </span>
          <span>
            <Video size={14} aria-hidden="true" />
            Google Meet
          </span>
          <span>
            <MessageSquare size={14} aria-hidden="true" />
            Đã hỏi {askedCount}/{questions.length}
          </span>
          <span>
            <Check size={14} aria-hidden="true" />
            Đã chấm {ratedCount}/{candidate.criteria.length} tiêu chí
          </span>
        </div>
      </div>

      <div className="studio-grid">
        <section className="card question-pane" aria-label="Danh sách câu hỏi">
          <CardHead
            title="Câu hỏi theo chủ đề"
            meta={`${questions.length} câu · ${grouped.length} nhóm`}
          />
          <div className="question-groups">
            {grouped.map((group) => (
              <div className="q-group" key={group.category}>
                <div className="q-group-head">
                  <span className="q-group-title">{group.category}</span>
                  <span className="q-group-count num">{group.items.length}</span>
                </div>
                {group.items.map((question) => {
                  const index = questions.indexOf(question) + 1;
                  const on = selected?.id === question.id;
                  return (
                    <button
                      key={question.id}
                      type="button"
                      className={`q-item${on ? " is-on" : ""}${
                        asked[question.id] ? " is-asked" : ""
                      }`}
                      aria-current={on ? "true" : undefined}
                      onClick={() => {
                        setSelectedId(question.id);
                        setTab("hints");
                      }}
                    >
                      <span className="q-num num">{index}</span>
                      <span className="q-item-main">
                        <span className="q-item-text">{question.text}</span>
                        <span className="q-item-meta">
                          {question.difficulty}
                          {asked[question.id] ? " · đã hỏi" : ""}
                        </span>
                      </span>
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <section className="card answer-pane" aria-label="Chi tiết câu hỏi">
          {selected ? (
            <>
              <div className="answer-head">
                <div className="answer-meta">
                  <span className="pill pill-neutral">{selected.category}</span>
                  <span className="pill pill-neutral">{selected.difficulty}</span>
                  <span className="answer-index num">
                    Câu {questions.indexOf(selected) + 1}/{questions.length}
                  </span>
                </div>
                <button
                  type="button"
                  className={`asked-toggle${asked[selected.id] ? " is-on" : ""}`}
                  aria-pressed={Boolean(asked[selected.id])}
                  onClick={() =>
                    setAsked((prev) => ({
                      ...prev,
                      [selected.id]: !prev[selected.id],
                    }))
                  }
                >
                  <Check size={14} aria-hidden="true" />
                  {asked[selected.id] ? "Đã hỏi" : "Đánh dấu đã hỏi"}
                </button>
              </div>

              <p className="answer-question">{selected.text}</p>

              <div className="answer-tabs" role="tablist" aria-label="Nội dung câu trả lời">
                {(
                  [
                    { key: "hints", label: "Gợi ý" },
                    { key: "sample", label: "Câu trả lời mẫu" },
                    { key: "checks", label: "Điểm cần kiểm tra" },
                  ] as { key: AnswerTab; label: string }[]
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.key}
                    className={`answer-tab${tab === item.key ? " is-on" : ""}`}
                    onClick={() => setTab(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="answer-body" role="tabpanel">
                {tab === "hints" ? (
                  <>
                    <ul className="hint-list">
                      {hintPrompts.map((hint) => (
                        <li key={hint}>{hint}</li>
                      ))}
                    </ul>
                    <div className="follow-ups">
                      <h3 className="mini-title">Câu hỏi nối tiếp</h3>
                      <ul className="plain-list">
                        {selected.followUps.map((followUp) => (
                          <li key={followUp}>{followUp}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : null}

                {tab === "sample" ? (
                  <div className="sample-answer">
                    <p>{selected.answer}</p>
                    <span className="foot-note">
                      Câu trả lời mẫu là hướng dẫn, không phải đáp án bắt buộc.
                    </span>
                  </div>
                ) : null}

                {tab === "checks" ? (
                  <div className="check-list" role="group" aria-label="Điểm cần kiểm tra">
                    {checkPoints.map((point, index) => {
                      const key = `${selected.id}-${index}`;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="checkbox"
                          aria-checked={Boolean(checks[key])}
                          className={`check-row${checks[key] ? " is-on" : ""}`}
                          onClick={() =>
                            setChecks((prev) => ({ ...prev, [key]: !prev[key] }))
                          }
                        >
                          <span className="check-box" aria-hidden="true">
                            {checks[key] ? <Check size={12} /> : null}
                          </span>
                          <span>{point}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="answer-note">
                <label className="field">
                  <span className="field-label">Ghi chú cho câu hỏi này</span>
                  <textarea
                    className="note-input"
                    rows={3}
                    value={notes[selected.id] ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setNotes((prev) => ({ ...prev, [selected.id]: value }));
                      setSavedNotes((prev) => ({
                        ...prev,
                        [selected.id]: false,
                      }));
                    }}
                    placeholder="Câu trả lời nổi bật, điểm cần đào sâu, bằng chứng bổ sung…"
                  />
                </label>
                <div className="note-foot">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!notes[selected.id]?.trim()}
                    onClick={() =>
                      setSavedNotes((prev) => ({
                        ...prev,
                        [selected.id]: true,
                      }))
                    }
                  >
                    Lưu ghi chú
                  </button>
                  {savedNotes[selected.id] ? (
                    <span className="save-state" role="status">
                      Đã lưu trong phiên
                    </span>
                  ) : (
                    <span className="foot-note">
                      Ghi chú chỉ hiển thị với người phỏng vấn.
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              title="Chưa có câu hỏi"
              detail="Tạo báo cáo ứng viên trước để sinh câu hỏi phỏng vấn."
            />
          )}
        </section>

        <aside className="studio-rail">
          <section className="card">
            <CardHead
              title="Rubric phỏng vấn"
              meta={`${candidate.criteria.length} tiêu chí · thang 0–4`}
            />
            <div className="rubric-list">
              {candidate.criteria.map((criterion) => {
                const value = ratings[criterion.id];
                return (
                  <div className="rubric-row" key={criterion.id}>
                    <div className="rubric-head">
                      <span className="rubric-label">{criterion.label}</span>
                      <span className="rubric-value num">
                        {value !== undefined ? `${value}/4` : "—"}
                      </span>
                    </div>
                    <div
                      className="rubric-scale"
                      role="group"
                      aria-label={`Chấm điểm ${criterion.label}`}
                    >
                      {[0, 1, 2, 3, 4].map((score) => (
                        <button
                          key={score}
                          type="button"
                          className={`rubric-btn${
                            value === score ? " is-on" : ""
                          }`}
                          aria-pressed={value === score}
                          aria-label={`${criterion.label}: ${score} trên 4`}
                          onClick={() => toggleRating(criterion.id, score)}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="card-foot">
              <span className="foot-note">
                Điểm do người phỏng vấn chấm; không dùng điểm tổng tự động.
              </span>
            </div>
          </section>

          <section className="card">
            <CardHead title="Phiên phỏng vấn" />
            <dl className="info-list">
              <div>
                <dt>Người phỏng vấn</dt>
                <dd>Minh Anh</dd>
              </div>
              <div>
                <dt>Thời gian</dt>
                <dd className="num">26/10/2026 · 15:00</dd>
              </div>
              <div>
                <dt>Hình thức</dt>
                <dd>Google Meet · 60 phút</dd>
              </div>
              <div>
                <dt>Vòng</dt>
                <dd>Vòng 2 · Technical</dd>
              </div>
            </dl>
            <div className="card-foot">
              <button
                type="button"
                className="card-link"
                onClick={() => go("repository", candidate.id)}
              >
                Xem repository đã phân tích
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
