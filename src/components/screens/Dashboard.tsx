"use client";

import {
  ArrowRight,
  ChevronRight,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import type { Candidate, Screen } from "@/data/codecv";
import { candidateEvidence } from "@/data/codecv";
import { useDashboard, useStages, useStatsQuery } from "@/lib/api";
import { useLocaleDate, useT, type MessageKey } from "@/lib/i18n";
import {
  Avatar,
  CardHead,
  EmptyState,
  EvidenceMeter,
  LoadError,
  PageHead,
  ScreenLoader,
  StageLadder,
  StatusPill,
} from "../ui";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function parseUpdatedAt(value: string): number | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) · (\d{2}):(\d{2})$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const time = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  ).getTime();
  return Number.isNaN(time) ? null : time;
}


const stageDetailKeys: MessageKey[] = [
  "dashboard.stage.0",
  "dashboard.stage.1",
  "dashboard.stage.2",
  "dashboard.stage.3",
  "dashboard.stage.4",
  "dashboard.stage.5",
];

export default function Dashboard({
  go,
  teamName,
}: {
  go: (screen: Screen, id?: string) => void;
  teamName: string;
}) {
  const { data, loading, error, refetch } = useDashboard();
  const statsResult = useStatsQuery();
  const stages = useStages().data ?? [];
  const t = useT();
  const localeDate = useLocaleDate();

  if (loading || statsResult.loading) {
    return <ScreenLoader title={t("screen.dashboard")} />;
  }

  if (error || statsResult.error || !data || !statsResult.data) {
    return (
      <div className="screen">
        <PageHead title={t("screen.dashboard")} sub={teamName} />
        <LoadError
          message={error ?? statsResult.error ?? t("dashboard.noData")}
          onRetry={() => {
            refetch();
            statsResult.refetch();
          }}
        />
      </div>
    );
  }

  const { review, processing, recent, positions } = data;
  const stats = statsResult.data;
  const rankedPositions = positions
    .map((position) => ({
      ...position,
      liveCount: position.candidateCount ?? 0,
    }))
    .sort(
      (a, b) =>
        b.liveCount - a.liveCount ||
        b.candidates - a.candidates ||
        a.title.localeCompare(b.title),
    );
  const topPositions = rankedPositions.slice(0, 5);
  const totalStages = stages.length || 6;

  const now = new Date().getTime();
  const dated: { candidate: Candidate; time: number }[] = [];
  for (const candidate of review) {
    const time = parseUpdatedAt(candidate.updatedAt);
    if (time !== null) {
      dated.push({ candidate, time });
    }
  }
  const overdueCount = dated.filter((entry) => now - entry.time > DAY).length;
  const oldest = dated.reduce<{ candidate: Candidate; time: number } | null>(
    (min, entry) => (min === null || entry.time < min.time ? entry : min),
    null,
  );
  const oldestDays = oldest
    ? Math.max(1, Math.floor((now - oldest.time) / DAY))
    : 0;

  const positionsTotal = positions.reduce(
    (sum, position) => sum + (position.candidateCount ?? 0),
    0,
  );
  const shownTotal = topPositions.reduce(
    (sum, position) => sum + position.liveCount,
    0,
  );
  const restCandidates = positionsTotal - shownTotal;
  const restPositions = positions.length - topPositions.length;
  const barMax = Math.max(
    ...positions.map((position) => position.candidateCount ?? 0),
    1,
  );

  const lastUpdated = recent[0]?.updated || stats.updated;

  return (
    <div className="screen">
      <PageHead
        title={t("screen.dashboard")}
        sub={t("dashboard.sub", {
          team: teamName,
          date: localeDate(new Date()),
          count: stats.total,
        })}
        actions={
          <>
            {lastUpdated ? (
              <span className="stamp">
                <RefreshCw size={13} aria-hidden="true" />
                {t("dashboard.updatedAt", { time: lastUpdated })}
              </span>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => go("upload")}
            >
              <UploadCloud size={15} aria-hidden="true" />
              {t("dashboard.newAnalysis")}
            </button>
          </>
        }
      />

      <section className="kpi-strip" aria-label={t("dashboard.kpi.label")}>
        <div className="kpi-cell">
          <span className="kpi-label">{t("dashboard.kpi.total")}</span>
          <span className="kpi-value num">{stats.total}</span>
          <span className="kpi-note">
            {t("dashboard.kpi.positions", { count: stats.positions })}
          </span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">{t("dashboard.kpi.processing")}</span>
          <span className="kpi-value num">{stats.processing}</span>
          <span className="kpi-note">{t("dashboard.kpi.processingNote")}</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">{t("dashboard.kpi.completed")}</span>
          <span className="kpi-value num">{stats.completed}</span>
          <span className="kpi-note">{t("dashboard.kpi.completedNote")}</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">{t("dashboard.kpi.review")}</span>
          <span className="kpi-value num">{stats.review}</span>
          <span className="kpi-note">
            {overdueCount > 0
              ? t("dashboard.kpi.overdue", { count: overdueCount })
              : t("dashboard.kpi.overdueNone")}
          </span>
        </div>
      </section>

      <div className="overview-grid">
        <section className="card">
          <CardHead
            title={t("dashboard.review.title")}
            meta={
              overdueCount > 0
                ? t("dashboard.review.meta", {
                    count: stats.review,
                    overdue: overdueCount,
                  })
                : t("dashboard.review.metaNone", { count: stats.review })
            }
            action={
              <button
                type="button"
                className="card-link"
                onClick={() => go("candidates")}
              >
                {t("action.viewAll")}
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            }
          />
          <div className="queue-list">
            {review.length === 0 ? (
              <EmptyState
                title={t("dashboard.review.emptyTitle")}
                detail={t("dashboard.review.emptyDetail")}
                action={
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => go("upload")}
                  >
                    <UploadCloud size={15} aria-hidden="true" />
                    {t("dashboard.newAnalysis")}
                  </button>
                }
              />
            ) : (
              review.map((candidate) => {
                const ev = candidateEvidence(candidate);
                return (
                  <div className="queue-row" key={candidate.id}>
                    <Avatar
                      initials={candidate.initials}
                      hue={candidate.hue}
                      size={34}
                      name={candidate.name}
                    />
                    <div className="queue-main">
                      <div className="queue-title">
                        <a
                          href={`#candidate/${candidate.id}`}
                          className="row-name"
                          onClick={(event) => {
                            event.preventDefault();
                            go("candidate", candidate.id);
                          }}
                        >
                          {candidate.name}
                        </a>
                        <StatusPill status={candidate.status} />
                      </div>
                      <span className="queue-sub">
                        {t("dashboard.review.rowMeta", {
                          position: candidate.position,
                          updated: candidate.updated,
                        })}
                      </span>
                      <div className="queue-evidence">
                        <EvidenceMeter
                          verified={ev.verified}
                          inferred={ev.inferred}
                          missing={ev.missing}
                          total={ev.total}
                        />
                        <span className="evidence-text">
                          {t("dashboard.review.evidence", {
                            covered: ev.covered,
                            total: ev.total,
                            missing: ev.missing,
                          })}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="row-go"
                      aria-label={t("dashboard.review.openAria", {
                        name: candidate.name,
                      })}
                      onClick={() => go("candidate", candidate.id)}
                    >
                      <ArrowRight size={16} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="card-foot">
            <span className="foot-note">
              {oldest
                ? t("dashboard.review.oldest", {
                    name: oldest.candidate.name,
                    duration: t("dashboard.review.days", {
                      count: oldestDays,
                    }),
                  })
                : t("dashboard.review.emptyFoot")}
            </span>
            <button
              type="button"
              className="card-link"
              onClick={() => go("candidates")}
            >
              {t("dashboard.review.openQueue")}
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="card">
          <CardHead
            title={t("dashboard.processing.title")}
            meta={t("dashboard.processing.meta", { count: stats.processing })}
            action={
              <button
                type="button"
                className="card-link"
                onClick={() => go("candidates")}
              >
                {t("dashboard.processing.viewProgress")}
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            }
          />
          <div className="progress-list">
            {processing.length === 0 ? (
              <EmptyState
                title={t("dashboard.processing.emptyTitle")}
                detail={t("dashboard.processing.emptyDetail")}
                action={
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => go("upload")}
                  >
                    <UploadCloud size={15} aria-hidden="true" />
                    {t("dashboard.newAnalysis")}
                  </button>
                }
              />
            ) : (
              processing.map((candidate) => {
                const step = Math.min(
                  Math.max(candidate.stageIndex ?? 0, 0),
                  totalStages - 1,
                );
                return (
                  <button
                    type="button"
                    className="progress-row"
                    key={candidate.id}
                    onClick={() => go("candidate", candidate.id)}
                  >
                    <Avatar
                      initials={candidate.initials}
                      hue={candidate.hue}
                      size={30}
                      name={candidate.name}
                    />
                    <span className="progress-main">
                      <span className="progress-title">{candidate.name}</span>
                      <span className="progress-sub">
                        {candidate.role} ·{" "}
                        {stages[step]?.label ??
                          t(stageDetailKeys[step] ?? "dashboard.stage.running")}
                      </span>
                      <StageLadder
                        step={step}
                        labels={false}
                        total={totalStages}
                      />
                    </span>
                    <span className="progress-side">
                      <span className="progress-step num">
                        {step + 1}/{totalStages}
                      </span>
                      <span className="progress-detail">
                        {stages[step]?.detail ||
                          t(stageDetailKeys[step] ?? "dashboard.stage.running")}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="card-foot">
            <span className="foot-note">
              {t("dashboard.processing.note")}
            </span>
          </div>
        </section>
      </div>

      <div className="overview-grid overview-grid-lower">
        <section className="card">
          <CardHead
            title={t("dashboard.recent.title")}
            meta={t("dashboard.recent.meta", { count: recent.length })}
            action={
              <button
                type="button"
                className="card-link"
                onClick={() => go("candidates")}
              >
                {t("action.viewAll")}
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            }
          />
          {recent.length === 0 ? (
            <EmptyState
              title={t("dashboard.recent.emptyTitle")}
              detail={t("dashboard.recent.emptyDetail")}
            />
          ) : (
            <div className="table-wrap">
              <table className="table table-recent">
                <thead>
                  <tr>
                    <th>{t("dashboard.recent.colCandidate")}</th>
                    <th>{t("dashboard.recent.colPosition")}</th>
                    <th className="num">{t("dashboard.recent.colEvidence")}</th>
                    <th>{t("dashboard.recent.colStatus")}</th>
                    <th className="num">{t("dashboard.recent.colUpdated")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((candidate) => {
                    const ev = candidateEvidence(candidate);
                    return (
                      <tr key={candidate.id}>
                        <td className="c-name">
                          <div className="person-cell">
                            <Avatar
                              initials={candidate.initials}
                              hue={candidate.hue}
                              size={30}
                              name={candidate.name}
                            />
                            <span className="person-main">
                              <a
                                href={`#candidate/${candidate.id}`}
                                className="row-name"
                                onClick={(event) => {
                                  event.preventDefault();
                                  go("candidate", candidate.id);
                                }}
                              >
                                {candidate.name}
                              </a>
                              <span className="person-sub">
                                {candidate.email}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td
                          className="c-role"
                          data-label={t("dashboard.recent.colPosition")}
                        >
                          {candidate.position}
                        </td>
                        <td
                          className="num c-evidence fig"
                          data-label={t("dashboard.recent.colEvidence")}
                        >
                          {ev.covered}/{ev.total}
                        </td>
                        <td
                          className="c-status"
                          data-label={t("dashboard.recent.colStatus")}
                        >
                          <StatusPill status={candidate.status} />
                        </td>
                        <td
                          className="num c-updated"
                          data-label={t("dashboard.recent.colUpdated")}
                        >
                          {candidate.updated}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <CardHead
            title={t("dashboard.positions.title")}
            meta={t("dashboard.positions.meta", { count: positionsTotal })}
            action={
              <button
                type="button"
                className="card-link"
                onClick={() => go("jobs")}
              >
                {t("dashboard.positions.link")}
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            }
          />
          <div className="bar-list">
            {topPositions.length === 0 ? (
              <EmptyState
                title={t("dashboard.positions.emptyTitle")}
                detail={t("dashboard.positions.emptyDetail")}
                action={
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => go("jobs")}
                  >
                    {t("dashboard.positions.link")}
                    <ChevronRight size={13} aria-hidden="true" />
                  </button>
                }
              />
            ) : (
              topPositions.map((position, index) => (
                <div className="bar-row" key={position.id}>
                  <div className="bar-top">
                    <span className="bar-label">{position.title}</span>
                    <span className="bar-value num">{position.liveCount}</span>
                  </div>
                  <div className="bar-track">
                    <span
                      className={`bar-fill${index === 0 ? " is-lead" : ""}`}
                      style={{
                        width: `${(position.liveCount / barMax) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          {restCandidates > 0 && restPositions > 0 ? (
            <div className="card-foot">
              <span className="foot-note">
                {t("dashboard.positions.more", {
                  count: restCandidates,
                  positions: restPositions,
                })}
              </span>
            </div>
          ) : null}
        </section>
      </div>

      {overdueCount > 0 && oldest ? (
        <div className="screen-note">
          <strong>{t("dashboard.note.title")}</strong>{" "}
          {t("dashboard.note.body", {
            count: overdueCount,
            name: oldest.candidate.name,
          })}
        </div>
      ) : null}
    </div>
  );
}
