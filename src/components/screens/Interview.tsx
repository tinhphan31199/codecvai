"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import type { CandidateStatus, Question, Screen } from "@/data/codecv";
import { generateQuestions, statusMeta } from "@/data/codecv";
import { useCandidate, useCandidates } from "@/lib/api";
import { useT, type MessageKey } from "@/lib/i18n";
import {
  Avatar,
  CardHead,
  EmptyState,
  LoadError,
  PageHead,
  ScreenLoader,
  StatusPill,
} from "../ui";

const categoryKeys: Partial<Record<string, MessageKey>> = {
  Architecture: "interview.category.architecture",
  Database: "interview.category.database",
  Messaging: "interview.category.messaging",
  Security: "interview.category.security",
  Testing: "interview.category.testing",
};

const knownCategories = Object.keys(categoryKeys);

type AnswerTab = "hints" | "sample" | "checks";

const answerTabs: { key: AnswerTab; labelKey: MessageKey }[] = [
  { key: "hints", labelKey: "interview.tab.hints" },
  { key: "sample", labelKey: "interview.tab.sample" },
  { key: "checks", labelKey: "interview.tab.checks" },
];

const checkPointKeys: MessageKey[] = [
  "interview.check.1",
  "interview.check.2",
  "interview.check.3",
];

const hintKeys: MessageKey[] = [
  "interview.hint.1",
  "interview.hint.2",
  "interview.hint.3",
];

export default function InterviewStudio({
  id,
  go,
}: {
  id: string;
  go: (screen: Screen, id?: string) => void;
}) {
  const { data: candidate, loading, error, refetch } = useCandidate(id);
  const t = useT();
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
    return <ScreenLoader title={t("screen.interview")} />;
  }

  if (error) {
    return (
      <div className="screen">
        <PageHead title={t("screen.interview")} />
        <LoadError message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="screen">
        <EmptyState
          title={t("interview.notFound.title")}
          detail={t("interview.notFound.detail")}
          action={
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => go("candidates")}
            >
              {t("interview.notFound.action")}
            </button>
          }
        />
      </div>
    );
  }

  const presentCategories: string[] = Array.from(
    new Set(questions.map((item) => item.category)),
  );
  const groupOrder = [
    ...knownCategories.filter((category) => presentCategories.includes(category)),
    ...presentCategories.filter((category) => !knownCategories.includes(category)),
  ];
  const grouped = groupOrder
    .map((category) => ({
      category,
      items: questions.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);
  const orderedQuestions = grouped.flatMap((group) => group.items);

  const selected: Question | undefined =
    orderedQuestions.find((item) => item.id === selectedId) ??
    orderedQuestions[0];

  const categoryLabel = (category: string) => {
    const key = categoryKeys[category];
    return key ? t(key) : category;
  };

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
      t("interview.export.docTitle"),
      "",
      `**${candidate.name}** · ${candidate.position}`,
      t("interview.export.interviewer", {
        reviewer: candidate.reviewer || "—",
        updated: candidate.updatedAt,
      }),
      "",
      t("interview.export.rubric"),
      ...candidate.criteria.map(
        (item) =>
          t("interview.export.rating", {
            label: item.label,
            rating:
              ratings[item.id] !== undefined
                ? `${ratings[item.id]}/4`
                : t("interview.export.unrated"),
          }),
      ),
      "",
      t("interview.export.asked"),
      ...orderedQuestions
        .filter((item) => asked[item.id])
        .map((item, index) => `${index + 1}. ${item.text}`),
      "",
      t("interview.export.notes"),
      ...(Object.keys(notes).some((key) => notes[key]?.trim())
        ? orderedQuestions
            .filter((item) => notes[item.id]?.trim())
            .map((item) =>
              t("interview.export.noteLine", {
                index: orderedQuestions.indexOf(item) + 1,
                note: notes[item.id] ?? "",
              }),
            )
        : [t("interview.export.noNotes")]),
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
        title={t("screen.interview")}
        sub={t("interview.sub", {
          name: candidate.name,
          position: candidate.position,
          count: questions.length,
        })}
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => go("candidate", candidate.id)}
            >
              {t("interview.openProfile")}
            </button>
            <button type="button" className="btn btn-primary" onClick={exportSheet}>
              <Download size={15} aria-hidden="true" />
              {t("interview.export")}
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
              {t("interview.person.meta", {
                role: candidate.role,
                years: candidate.years,
                location: candidate.location,
              })}
            </span>
          </div>
        </div>
        <div className="studio-meta">
          <span>
            <Clock size={14} aria-hidden="true" />
            {t("interview.updated", { time: candidate.updatedAt })}
          </span>
          <span>
            <MessageSquare size={14} aria-hidden="true" />
            {t("interview.askedProgress", {
              asked: askedCount,
              total: questions.length,
            })}
          </span>
          <span>
            <Check size={14} aria-hidden="true" />
            {t("interview.ratedProgress", {
              rated: ratedCount,
              total: candidate.criteria.length,
            })}
          </span>
        </div>
      </div>

      <div className="studio-grid">
        <section
          className="card question-pane"
          aria-label={t("interview.questions.aria")}
        >
          <CardHead
            title={t("interview.questions.title")}
            meta={t("interview.questions.meta", {
              count: questions.length,
              groups: grouped.length,
            })}
          />
          <div className="question-groups">
            {grouped.map((group) => (
              <div className="q-group" key={group.category}>
                <div className="q-group-head">
                  <span className="q-group-title">
                    {categoryLabel(group.category)}
                  </span>
                  <span className="q-group-count num">{group.items.length}</span>
                </div>
                {group.items.map((question) => {
                  const index = orderedQuestions.indexOf(question) + 1;
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
                          {asked[question.id]
                            ? t("interview.questions.askedMeta", {
                                difficulty: question.difficulty,
                              })
                            : question.difficulty}
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

        <section className="card answer-pane" aria-label={t("interview.answer.aria")}>
          {selected ? (
            <>
              <div className="answer-head">
                <div className="answer-meta">
                  <span className="pill pill-neutral">
                    {categoryLabel(selected.category)}
                  </span>
                  <span className="pill pill-neutral">{selected.difficulty}</span>
                  <span className="answer-index num">
                    {t("interview.answer.index", {
                      current: orderedQuestions.indexOf(selected) + 1,
                      total: orderedQuestions.length,
                    })}
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
                  {asked[selected.id]
                    ? t("interview.answer.badge")
                    : t("interview.answer.markAsked")}
                </button>
              </div>

              <p className="answer-question">{selected.text}</p>

              <div
                className="answer-tabs"
                role="tablist"
                aria-label={t("interview.answer.tabsAria")}
              >
                {answerTabs.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.key}
                    className={`answer-tab${tab === item.key ? " is-on" : ""}`}
                    onClick={() => setTab(item.key)}
                  >
                    {t(item.labelKey)}
                  </button>
                ))}
              </div>

              <div className="answer-body" role="tabpanel">
                {tab === "hints" ? (
                  <>
                    <ul className="hint-list">
                      {hintKeys.map((hintKey) => (
                        <li key={hintKey}>{t(hintKey)}</li>
                      ))}
                    </ul>
                    <div className="follow-ups">
                      <h3 className="mini-title">{t("interview.followUps")}</h3>
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
                      {t("interview.sample.note")}
                    </span>
                  </div>
                ) : null}

                {tab === "checks" ? (
                  <div
                    className="check-list"
                    role="group"
                    aria-label={t("interview.tab.checks")}
                  >
                    {checkPointKeys.map((pointKey, index) => {
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
                          <span>{t(pointKey)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="answer-note">
                <label className="field">
                  <span className="field-label">{t("interview.note.label")}</span>
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
                    placeholder={t("interview.note.placeholder")}
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
                    {t("interview.note.save")}
                  </button>
                  {savedNotes[selected.id] ? (
                    <span className="save-state" role="status">
                      {t("interview.note.saved")}
                    </span>
                  ) : (
                    <span className="foot-note">
                      {t("interview.note.hint")}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              title={t("interview.empty.title")}
              detail={t("interview.empty.detail")}
            />
          )}
        </section>

        <aside className="studio-rail">
          <section className="card">
            <CardHead
              title={t("interview.rubric.title")}
              meta={t("interview.rubric.meta", {
                count: candidate.criteria.length,
              })}
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
                      aria-label={t("interview.rubric.groupAria", {
                        criterion: criterion.label,
                      })}
                    >
                      {[0, 1, 2, 3, 4].map((score) => (
                        <button
                          key={score}
                          type="button"
                          className={`rubric-btn${
                            value === score ? " is-on" : ""
                          }`}
                          aria-pressed={value === score}
                          aria-label={t("interview.rubric.btnAria", {
                            criterion: criterion.label,
                            score,
                          })}
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
                {t("interview.rubric.note")}
              </span>
            </div>
          </section>

          <section className="card">
            <CardHead title={t("interview.session.title")} />
            <dl className="info-list">
              <div>
                <dt>{t("interview.session.interviewer")}</dt>
                <dd>{candidate.reviewer || "—"}</dd>
              </div>
              <div>
                <dt>{t("interview.session.updated")}</dt>
                <dd className="num">{candidate.updatedAt}</dd>
              </div>
              <div>
                <dt>{t("interview.session.level")}</dt>
                <dd>{candidate.level || "—"}</dd>
              </div>
              <div>
                <dt>{t("interview.session.source")}</dt>
                <dd>{candidate.source || "—"}</dd>
              </div>
            </dl>
            <div className="card-foot">
              <button
                type="button"
                className="card-link"
                onClick={() => go("repository", candidate.id)}
              >
                {t("interview.session.repository")}
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

const PICKER_PAGE_SIZE = 8;

const statusFilters: (CandidateStatus | "all")[] = [
  "all",
  "completed",
  "review",
  "processing",
  "failed",
  "archived",
];

export function InterviewPicker({
  go,
}: {
  go: (screen: Screen, id?: string) => void;
}) {
  const { data, loading, error, refetch } = useCandidates();
  const t = useT();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CandidateStatus | "all">("all");
  const [position, setPosition] = useState("all");
  const [page, setPage] = useState(1);

  const list = useMemo(() => data ?? [], [data]);
  const positions = useMemo(
    () => Array.from(new Set(list.map((candidate) => candidate.position))),
    [list],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((candidate) => {
      if (status !== "all" && candidate.status !== status) return false;
      if (position !== "all" && candidate.position !== position) return false;
      if (!q) return true;
      return `${candidate.name} ${candidate.email} ${candidate.position} ${candidate.role}`
        .toLowerCase()
        .includes(q);
    });
  }, [list, query, status, position]);

  const pages = Math.max(1, Math.ceil(rows.length / PICKER_PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * PICKER_PAGE_SIZE;
  const visible = rows.slice(start, start + PICKER_PAGE_SIZE);
  const filtered = Boolean(query || status !== "all" || position !== "all");

  const reset = () => {
    setQuery("");
    setStatus("all");
    setPosition("all");
    setPage(1);
  };

  const statusCount = (value: CandidateStatus | "all") =>
    value === "all"
      ? list.length
      : list.filter((candidate) => candidate.status === value).length;

  if (loading) {
    return <ScreenLoader title={t("screen.interview")} />;
  }

  if (error) {
    return (
      <div className="screen">
        <PageHead title={t("screen.interview")} />
        <LoadError message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="screen">
      <PageHead
        title={t("screen.interview")}
        sub={t("interview.select.sub")}
      />
      <section className="card">
        <CardHead
          title={t("interview.select.title")}
          meta={t("interview.select.meta", { count: list.length })}
        />
        {list.length === 0 ? (
          <EmptyState
            title={t("interview.select.empty.title")}
            detail={t("interview.select.empty.detail")}
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => go("upload")}
              >
                {t("interview.select.empty.action")}
              </button>
            }
          />
        ) : (
          <>
            <div className="filter-bar">
              <div className="filter-search">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder={t("interview.select.searchPlaceholder")}
                  aria-label={t("interview.select.searchAria")}
                />
                {query ? (
                  <button
                    type="button"
                    className="filter-clear"
                    aria-label={t("interview.select.clearSearchAria")}
                    onClick={() => setQuery("")}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <label className="filter-select">
                <span className="visually-hidden">
                  {t("interview.select.filterPositionAria")}
                </span>
                <select
                  value={position}
                  onChange={(event) => {
                    setPosition(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">
                    {t("interview.select.allPositions")}
                  </option>
                  {positions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="filter-row">
              <div
                className="chip-group"
                role="group"
                aria-label={t("interview.select.filterStatusAria")}
              >
                {statusFilters.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`chip${status === value ? " is-on" : ""}`}
                    aria-pressed={status === value}
                    onClick={() => {
                      setStatus(value);
                      setPage(1);
                    }}
                  >
                    {value === "all"
                      ? t("interview.select.statusAll")
                      : t(statusMeta[value].labelKey)}{" "}
                    <span className="num">{statusCount(value)}</span>
                  </button>
                ))}
              </div>
              <div className="filter-summary">
                {filtered ? (
                  <button type="button" className="text-btn" onClick={reset}>
                    {t("interview.select.clearFilters")}
                  </button>
                ) : null}
                <span className="result-count">
                  {t("interview.select.resultCount", { count: rows.length })}
                </span>
              </div>
            </div>

            {visible.length ? (
              <>
                <div className="progress-list">
                  {visible.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      className="progress-row"
                      aria-label={t("interview.select.action", {
                        name: candidate.name,
                      })}
                      onClick={() => go("interview", candidate.id)}
                    >
                      <Avatar
                        initials={candidate.initials}
                        hue={candidate.hue}
                        size={34}
                        name={candidate.name}
                      />
                      <span className="progress-main">
                        <span className="progress-title">
                          {candidate.name}
                        </span>
                        <span className="progress-sub">
                          {candidate.position} · {candidate.level} ·{" "}
                          {candidate.location}
                        </span>
                      </span>
                      <span className="progress-side">
                        <StatusPill status={candidate.status} />
                        <span className="progress-detail">
                          {candidate.updated}
                        </span>
                      </span>
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  ))}
                </div>

                <div className="pagination">
                  <span className="page-info">
                    {t("interview.select.pageInfo", {
                      from: start + 1,
                      to: Math.min(start + PICKER_PAGE_SIZE, rows.length),
                      total: rows.length,
                    })}
                  </span>
                  <div className="page-controls">
                    <button
                      type="button"
                      className="btn btn-quiet"
                      disabled={safePage === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={14} aria-hidden="true" />
                      {t("interview.select.prev")}
                    </button>
                    <span className="page-current num">
                      {safePage}/{pages}
                    </span>
                    <button
                      type="button"
                      className="btn btn-quiet"
                      disabled={safePage === pages}
                      onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    >
                      {t("interview.select.next")}
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                title={t("interview.select.noMatch.title")}
                detail={t("interview.select.noMatch.detail")}
                action={
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={reset}
                  >
                    {t("interview.select.clearFilters")}
                  </button>
                }
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
