"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  GitBranch,
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
import {
  downloadCandidateCv,
  patchCandidate,
  retryRepositories,
  useCandidate,
  useRepository,
  type RepoRecord,
} from "@/lib/api";
import { useT, type MessageKey } from "@/lib/i18n";
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

const tabs: { key: TabKey; labelKey: MessageKey }[] = [
  { key: "overview", labelKey: "candidate.tabOverview" },
  { key: "evidence", labelKey: "candidate.tabEvidence" },
  { key: "repository", labelKey: "candidate.tabRepository" },
  { key: "questions", labelKey: "candidate.tabQuestions" },
  { key: "history", labelKey: "candidate.tabHistory" },
];

export default function CandidateDetail({
  id,
  go,
}: {
  id: string;
  go: (screen: Screen, id?: string) => void;
}) {
  const t = useT();
  const {
    data: candidate,
    loading,
    error,
    refetch,
    refresh: refreshCandidate,
  } = useCandidate(id);
  const { data: repoScan, refresh: refreshRepoScan } = useRepository(id);
  const overviewRef = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);
  const repoRef = useRef<HTMLDivElement>(null);
  const questionsRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cvBusy, setCvBusy] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [retryingScan, setRetryingScan] = useState<string | null>(null);
  const [scanError, setScanError] = useState("");

  const downloadCv = async () => {
    if (!candidate || cvBusy) return;
    setCvBusy(true);
    setCvError(null);
    try {
      await downloadCandidateCv(candidate.id);
    } catch (err) {
      setCvError(
        err instanceof Error ? err.message : t("candidate.downloadCvError"),
      );
    } finally {
      setCvBusy(false);
    }
  };

  useEffect(() => {
    if (candidate) {
      setNote(candidate.notes ?? "");
      setNoteSaved(false);
    }
  }, [candidate]);

  const pendingScans = (repoScan?.repositories ?? []).filter(
    (item) =>
      item.kind === "repo" &&
      (item.status === "pending" || item.status === "analyzing"),
  ).length;

  useEffect(() => {
    if (!pendingScans) return;
    const timer = window.setInterval(() => {
      refreshRepoScan();
      refreshCandidate();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pendingScans, refreshRepoScan, refreshCandidate]);

  const retryScan = async (label: string) => {
    setRetryingScan(label);
    setScanError("");
    try {
      await retryRepositories(id, label);
      refreshRepoScan();
      refreshCandidate();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetryingScan(null);
    }
  };

  if (loading) {
    return <ScreenLoader title={t("screen.candidate")} />;
  }

  if (error) {
    return (
      <div className="screen">
        <PageHead title={t("screen.candidate")} />
        <LoadError message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="screen">
        <EmptyState
          title={t("candidate.notFoundTitle")}
          detail={t("candidate.notFoundDetail")}
          action={
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => go("candidates")}
            >
              {t("candidate.backToList")}
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

  const scanRecords = (repoScan?.repositories ?? []).filter(
    (item) => item.kind !== "link",
  );
  const analyzedScans = scanRecords.filter(
    (item) => item.status === "analyzed",
  );
  const scanningScans = scanRecords.filter(
    (item) => item.status === "pending" || item.status === "analyzing",
  );
  const orderedScans = [
    ...analyzedScans,
    ...scanningScans,
    ...scanRecords.filter(
      (item) => item.status === "unavailable" || item.status === "skipped",
    ),
  ];

  const scanStatusLabel = (status: RepoRecord["status"]) => {
    switch (status) {
      case "analyzed":
        return t("repository.repoStatusAnalyzed");
      case "analyzing":
        return t("repository.repoStatusAnalyzing");
      case "pending":
        return t("repository.repoStatusPending");
      case "skipped":
        return t("repository.repoStatusSkipped");
      default:
        return t("repository.repoStatusUnavailable");
    }
  };

  const scanPillClass = (status: RepoRecord["status"]) =>
    status === "analyzed"
      ? "pill-positive"
      : status === "unavailable"
        ? "pill-negative"
        : "pill-neutral";

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
      `# CodeCV AI — ${t("candidate.mdTitle")}`,
      ``,
      `**${candidate.name}** · ${candidate.position} · ${candidate.level}`,
      `${candidate.email} · ${candidate.phone} · ${candidate.location}`,
      ``,
      `## ${t("candidate.mdSummary")}`,
      candidate.summary,
      ``,
      `## ${t("candidate.mdEvidence", {
        covered: ev.covered,
        total: ev.total,
      })}`,
      ...candidate.criteria.map(
        (item) =>
          `- [${t(evidenceMeta[item.state].labelKey)}] ${item.label} — ${t(
            "candidate.mdEvidenceCount",
            { count: item.evidence },
          )} · ${item.note}`,
      ),
      ``,
      `## ${t("candidate.mdStrengths")}`,
      ...candidate.strengths.map((item) => `- ${item}`),
      ``,
      `## ${t("candidate.mdVerify")}`,
      ...candidate.verify.map((item) => `- ${item}`),
      ``,
      `## ${t("candidate.mdNotes")}`,
      note.trim() || t("candidate.mdNoNote"),
      ``,
      t("candidate.source", {
        source: candidate.repo
          ? `${candidate.source} · ${candidate.repo}@${candidate.commit}`
          : candidate.source,
      }),
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
        {t("candidate.backLink")}
      </button>

      <PageHead
        title={candidate.name}
        sub={t("candidate.sub", {
          role: candidate.role,
          years: candidate.years,
          location: candidate.location,
          email: candidate.email,
        })}
        actions={
          <>
            {candidate.hasCv ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={downloadCv}
                disabled={cvBusy}
              >
                <Download size={15} aria-hidden="true" />
                {t("candidate.downloadCv")}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={exportReport}
            >
              <Download size={15} aria-hidden="true" />
              {t("candidate.exportReport")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={candidate.status === "failed"}
              onClick={() => go("interview", candidate.id)}
            >
              <MessageSquare size={15} aria-hidden="true" />
              {t("candidate.toInterview")}
            </button>
          </>
        }
      />

      {cvError ? (
        <p className="field-hint is-error" role="alert">
          {cvError}
        </p>
      ) : null}

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
              <span className="muted">
                {t("candidate.source", { source: candidate.source })}
              </span>
            </span>
            <span className="detail-person-sub">
              {t("candidate.reviewerMeta", {
                reviewer: candidate.reviewer ?? "—",
                updated: candidate.updated,
              })}
            </span>
          </div>
        </div>
        <div className="detail-health">
          <span className="health-label">{t("candidate.tabEvidence")}</span>
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

      <nav className="detail-tabs" aria-label={t("candidate.tabsAria")}>
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
            {t(item.labelKey)}
            {item.key === "evidence" ? (
              <span className="tab-count num">{ev.total}</span>
            ) : null}
            {item.key === "questions" ? (
              <span className="tab-count num">{questions.length}</span>
            ) : null}
          </button>
        ))}
        <span className="tabs-meta">
          {t("candidate.tabsMeta", { time: candidate.updatedAt })}
        </span>
      </nav>

      <div className="detail-grid">
        <div className="detail-main">
          {candidate.status === "failed" ? (
            <div className="callout callout-negative" role="status">
              <ShieldAlert size={17} aria-hidden="true" />
              <div>
                <p className="callout-title">{t("candidate.failedTitle")}</p>
                <p className="callout-body">{t("candidate.failedBody")}</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => go("upload")}
              >
                {t("candidate.reanalyze")}
              </button>
            </div>
          ) : null}

          {candidate.status === "processing" ? (
            <div className="callout" role="status">
              <Sparkles size={17} aria-hidden="true" />
              <div className="callout-grow">
                <p className="callout-title">{t("candidate.processingTitle")}</p>
                <p className="callout-body">{t("candidate.processingBody")}</p>
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
              title={t("candidate.summaryTitle")}
              meta={t("evidence.legend", {
                verified: ev.verified,
                inferred: ev.inferred,
                missing: ev.missing,
              })}
            />
            <div className="overview-body">
              <p className="lede">{candidate.summary.split(". ")[0]}.</p>
              <div className="split-lists">
                <div className="split-col">
                  <h3 className="mini-title">{t("candidate.strengthsTitle")}</h3>
                  <ul className="plain-list">
                    {candidate.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="split-col">
                  <h3 className="mini-title">{t("candidate.verifyTitle")}</h3>
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
              title={t("candidate.evidenceTableTitle")}
              meta={t("candidate.evidenceTableMeta", {
                total: ev.total,
                missing: ev.missing,
              })}
              action={
                <span className="legend-inline">
                  <span className="legend-dot is-verified" />
                  {t("evidence.verified")}
                  <span className="legend-dot is-inferred" />
                  {t("evidence.inferredShort")}
                  <span className="legend-dot is-missing" />
                  {t("evidence.missingShort")}
                </span>
              }
            />
            <div className="criterion-head">
              <span>{t("candidate.criterionColLabel")}</span>
              <span>{t("candidate.criterionColState")}</span>
              <span className="num">{t("candidate.criterionColEvidence")}</span>
            </div>
            <div className="criterion-list">
              {candidate.criteria.map((item) => (
                <CriterionRow key={item.id} item={item} />
              ))}
            </div>
            <div className="card-foot">
              <span className="foot-note">
                {t("candidate.evidenceFootNote")}
              </span>
              <button
                type="button"
                className="card-link"
                onClick={() => jump("repository", repoRef)}
              >
                {t("candidate.viewRepoFindings")}
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
              title={t("candidate.repoFindingsTitle")}
              meta={
                findings.length
                  ? t("candidate.repoFindingsMeta", {
                      repo: candidate.repo ?? "—",
                      commit: candidate.commit ?? "—",
                      count: findings.length,
                    })
                  : scanRecords.length
                    ? t("candidate.repoScannedMeta", {
                        analyzed: analyzedScans.length,
                        total: scanRecords.length,
                      })
                    : candidate.repo
                      ? t("candidate.repoFindingsMeta", {
                          repo: candidate.repo,
                          commit: candidate.commit ?? "—",
                          count: 0,
                        })
                      : t("candidate.repoNotConnected")
              }
              action={
                findings.length || scanRecords.length ? (
                  <button
                    type="button"
                    className="card-link"
                    onClick={() => go("repository", candidate.id)}
                  >
                    {t("candidate.openAnalysis")}
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
                      aria-label={t("candidate.severityLabel", {
                        level: t(severityMeta[finding.severity].labelKey),
                      })}
                      title={t("candidate.severityLabel", {
                        level: t(severityMeta[finding.severity].labelKey),
                      })}
                    />
                    <div className="finding-main">
                      <div className="finding-title-row">
                        <span className="finding-title">{finding.title}</span>
                        <span className={`pill ${findingStateMeta[finding.state].className}`}>
                          {t(findingStateMeta[finding.state].labelKey)}
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
                      aria-label={t("candidate.openFindingAria", {
                        title: finding.title,
                      })}
                      onClick={() => go("repository", candidate.id)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : orderedScans.length ? (
              <div className="scan-list">
                {orderedScans.slice(0, 3).map((item) => {
                  const scanLabel =
                    item.kind === "profile"
                      ? item.label
                      : item.label.replace(/^github\.com\//, "");
                  return (
                    <div className="scan-row" key={item.label}>
                      <GitBranch size={13} aria-hidden="true" />
                      <div className="scan-main">
                        <div className="scan-title-row">
                          <span
                            className="scan-label mono"
                            title={item.label}
                          >
                            {scanLabel}
                          </span>
                          <span className={`pill ${scanPillClass(item.status)}`}>
                            {scanStatusLabel(item.status)}
                          </span>
                        </div>
                        {item.context ? (
                          <p className="scan-context">{item.context}</p>
                        ) : null}
                        {item.detail ? (
                          <span className="scan-detail">{item.detail}</span>
                        ) : null}
                      </div>
                      {item.kind === "repo" &&
                      (item.status === "unavailable" ||
                        item.status === "skipped" ||
                        (item.status === "analyzed" && !item.hasTree)) ? (
                        <button
                          type="button"
                          className="text-btn scan-retry"
                          disabled={retryingScan === item.label}
                          aria-label={t(
                            item.status === "analyzed"
                              ? "repository.rereadAria"
                              : "repository.retryAria",
                            { label: scanLabel },
                          )}
                          onClick={() => void retryScan(item.label)}
                        >
                          {retryingScan === item.label
                            ? t("repository.retrying")
                            : item.status === "analyzed"
                              ? t("repository.reread")
                              : t("repository.retry")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t("candidate.openRepoScanAria", {
                          label: scanLabel,
                        })}
                        onClick={() => go("repository", candidate.id)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  );
                })}
                {scanError ? (
                  <p className="retry-error" role="alert">
                    {scanError}
                  </p>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title={t("candidate.repoEmptyTitle")}
                detail={
                  candidate.repo
                    ? t("candidate.repoEmptyConnectedDetail")
                    : t("candidate.repoEmptyDetail")
                }
                action={
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      candidate.repo
                        ? go("repository", candidate.id)
                        : go("upload")
                    }
                  >
                    {candidate.repo
                      ? t("candidate.openAnalysis")
                      : t("candidate.connectRepo")}
                  </button>
                }
              />
            )}
            {findings.length > 3 ? (
              <div className="card-foot">
                <span className="foot-note">
                  {t("candidate.moreFindings", { count: findings.length - 3 })}
                </span>
              </div>
            ) : null}
            {!findings.length && orderedScans.length ? (
              <div className="card-foot">
                <span className="foot-note">
                  {scanningScans.length
                    ? t("candidate.repoScanPending", {
                        count: scanningScans.length,
                      })
                    : orderedScans.length > 3
                      ? t("candidate.repoScanMore", {
                          count: orderedScans.length - 3,
                        })
                      : t("candidate.repoScanFoot")}
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
              title={t("candidate.questionsTitle")}
              meta={t("candidate.questionsMeta", { count: questions.length })}
              action={
                <button
                  type="button"
                  className="card-link"
                  onClick={() => go("interview", candidate.id)}
                >
                  {t("candidate.openInterview")}
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
                  ? t("candidate.moreQuestions", {
                      count: questions.length - 3,
                    })
                  : t("candidate.allQuestionsShown")}
              </span>
            </div>
          </section>

          <section
            className="card anchor-section"
            ref={historyRef}
            aria-labelledby="history-title"
          >
            <CardHead
              title={t("candidate.historyTitle")}
              meta={t("candidate.historyMeta", { count: history.length })}
            />
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
            <CardHead title={t("candidate.infoTitle")} />
            <dl className="info-list">
              <div>
                <dt>{t("candidate.infoPosition")}</dt>
                <dd>{candidate.position}</dd>
              </div>
              <div>
                <dt>{t("candidate.infoExperience")}</dt>
                <dd>{t("candidate.infoYears", { years: candidate.years })}</dd>
              </div>
              <div>
                <dt>{t("candidate.infoLocation")}</dt>
                <dd>{candidate.location}</dd>
              </div>
              <div>
                <dt>{t("candidate.infoSource")}</dt>
                <dd>{candidate.source}</dd>
              </div>
              <div>
                <dt>{t("candidate.infoReviewer")}</dt>
                <dd>{candidate.reviewer ?? t("candidate.unassigned")}</dd>
              </div>
              <div>
                <dt>{t("candidate.infoCreated")}</dt>
                <dd className="num">{candidate.createdAt}</dd>
              </div>
              <div>
                <dt>{t("candidate.infoContact")}</dt>
                <dd className="num">{candidate.phone}</dd>
              </div>
            </dl>
          </section>

          <section className="card">
            <CardHead
              title={t("candidate.skillsTitle")}
              meta={t("candidate.skillsMeta", { count: skills.length })}
            />
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
                {t("candidate.skillsFootNote", { count: missing.length })}
              </span>
            </div>
          </section>

          <section className="card">
            <CardHead title={t("candidate.noteTitle")} />
            <textarea
              className="note-input"
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setNoteSaved(false);
              }}
              rows={4}
              placeholder={t("candidate.notePlaceholder")}
              aria-label={t("candidate.noteAria")}
            />
            <div className="note-foot">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!note.trim() || saving}
                onClick={saveNote}
              >
                {saving ? t("candidate.saving") : t("candidate.saveNote")}
              </button>
              {noteSaved ? (
                <span className="save-state" role="status">
                  {t("candidate.noteSaved")}
                </span>
              ) : (
                <span className="foot-note">{t("candidate.notePrivate")}</span>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
