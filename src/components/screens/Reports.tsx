"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Download, FileText } from "lucide-react";
import type { Screen } from "@/data/codecv";
import { reportStatusMeta, statusMeta } from "@/data/codecv";
import {
  patchReportStatus,
  useCandidates,
  usePositions,
  useReports,
  useStats,
  type Report,
} from "@/lib/api";
import { useT, type MessageKey } from "@/lib/i18n";
import { CardHead, EmptyState, LoadError, PageHead, ScreenLoader } from "../ui";

type ReportTab = "candidates" | "distribution" | "quality";

const tabs: { key: ReportTab; labelKey: MessageKey }[] = [
  { key: "candidates", labelKey: "reports.tab.candidates" },
  { key: "distribution", labelKey: "reports.tab.distribution" },
  { key: "quality", labelKey: "reports.tab.quality" },
];

const statusOrder = [
  "completed",
  "review",
  "processing",
  "failed",
  "archived",
] as const;

export default function Reports({
  go,
}: {
  go: (screen: Screen, id?: string) => void;
}) {
  const [tab, setTab] = useState<ReportTab>("candidates");
  const [range, setRange] = useState("7");
  const t = useT();
  const today = (() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  })();
  const stats = useStats();
  const {
    data: reports,
    loading: reportsLoading,
    error: reportsError,
    refetch: refetchReports,
    refresh: refreshReports,
  } = useReports();
  const {
    data: candidateData,
    loading: candidatesLoading,
    error: candidatesError,
    refetch: refetchCandidates,
  } = useCandidates();
  const {
    data: positionData,
    loading: positionsLoading,
    error: positionsError,
    refetch: refetchPositions,
  } = usePositions();

  const loading = reportsLoading || candidatesLoading || positionsLoading;
  const error = reportsError ?? candidatesError ?? positionsError;
  const refetchAll = () => {
    refetchReports();
    refetchCandidates();
    refetchPositions();
  };

  const reportList = reports ?? [];
  const candidateList = candidateData ?? [];
  const positionList = positionData ?? [];

  const candidateById = useMemo(
    () => new Map(candidateList.map((item) => [item.id, item])),
    [candidateList],
  );

  if (loading) {
    return (
      <ScreenLoader title={t("screen.reports")} label={t("reports.loading")} />
    );
  }

  if (error) {
    return (
      <div className="screen">
        <PageHead title={t("screen.reports")} />
        <LoadError message={error} onRetry={refetchAll} />
      </div>
    );
  }

  const rangeStart = (() => {
    if (range === "today") {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      return midnight.getTime();
    }
    const days = range === "30" ? 30 : 7;
    return new Date().getTime() - days * 24 * 60 * 60 * 1000;
  })();

  const rows = reportList.filter((row) => {
    const createdAt = Date.parse(row.createdAt);
    return Number.isNaN(createdAt) || createdAt >= rangeStart;
  });

  const tabCounts: Record<ReportTab, number> = {
    candidates: rows.length,
    distribution: stats.total,
    quality: positionList.length,
  };

  const exported = rows.filter((row) => row.status === "exported").length;
  const review = rows.filter((row) => row.status === "review").length;
  const failed = rows.filter((row) => row.status === "failed").length;

  const download = (name: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const header = [
      t("reports.csv.code"),
      t("reports.csv.candidate"),
      t("reports.csv.position"),
      t("reports.csv.version"),
      t("reports.csv.reviewer"),
      t("reports.csv.created"),
      t("reports.csv.status"),
    ];
    const lines = rows.map((row) =>
      [
        row.id,
        row.candidate,
        row.position,
        `v${row.version}`,
        row.reviewer,
        row.created,
        t(reportStatusMeta[row.status].labelKey),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    );
    download(
      "CodeCV_reports.csv",
      `\uFEFF${[header.join(","), ...lines].join("\n")}`,
      "text/csv;charset=utf-8",
    );
  };

  const exportRow = async (row: Report) => {
    const candidate = candidateById.get(row.candidateId);
    if (!candidate) return;
    const content = [
      t("reports.exportMd.title", { name: candidate.name }),
      "",
      `${candidate.position} · ${candidate.level} · ${candidate.location}`,
      "",
      t("reports.exportMd.summary"),
      candidate.summary,
      "",
      t("reports.exportMd.evidence"),
      ...candidate.criteria.map(
        (item) =>
          `- ${item.label}: ${
            item.state === "verified"
              ? t("evidence.verified")
              : item.state === "inferred"
                ? t("evidence.inferredShort")
                : t("evidence.missing")
          } (${item.evidence})`,
      ),
      "",
      t("reports.exportMd.source", { source: candidate.source }),
    ].join("\n");
    download(
      `CodeCV_report_${candidate.id}.md`,
      content,
      "text/markdown;charset=utf-8",
    );

    if (row.status !== "exported") {
      try {
        await patchReportStatus(row.id, "exported");
        refreshReports();
      } catch {
        // Tệp đã tải xong; trạng thái sẽ đồng bộ ở lần tải lại sau.
      }
    }
  };

  const maxStatus = Math.max(
    0,
    ...statusOrder.map(
      (status) => candidateList.filter((c) => c.status === status).length,
    ),
  );
  const livePositions = positionList
    .map((position) => ({
      ...position,
      liveCount: position.candidateCount ?? 0,
    }))
    .filter((position) => position.liveCount > 0)
    .sort(
      (a, b) => b.liveCount - a.liveCount || a.title.localeCompare(b.title),
    );
  const positionTotal = livePositions.reduce(
    (sum, position) => sum + position.liveCount,
    0,
  );
  const shownPositions = livePositions.slice(0, 6);
  const hiddenPositions = livePositions.length - shownPositions.length;
  const maxPosition = Math.max(0, ...shownPositions.map((p) => p.liveCount));
  const weakPositions = positionList.filter((p) => p.criteria.length < 4);

  return (
    <div className="screen">
      <PageHead
        title={t("screen.reports")}
        sub={t("reports.sub", { updated: stats.updated })}
        actions={
          <>
            <label className="filter-select">
              <span className="visually-hidden">{t("reports.rangeLabel")}</span>
              <select
                value={range}
                onChange={(event) => setRange(event.target.value)}
              >
                <option value="today">
                  {t("reports.range.today", { date: today })}
                </option>
                <option value="7">{t("reports.range.days7")}</option>
                <option value="30">{t("reports.range.days30")}</option>
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={exportCsv}>
              <Download size={15} aria-hidden="true" />
              {t("reports.export")}
            </button>
          </>
        }
      />

      <section className="kpi-strip" aria-label={t("reports.kpi.label")}>
        <div className="kpi-cell">
          <span className="kpi-label">{t("reports.kpi.total")}</span>
          <span className="kpi-value num">{rows.length}</span>
          <span className="kpi-note">
            {t("reports.kpi.totalNote", { count: rows.length })}
          </span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">{t("reportStatus.exported")}</span>
          <span className="kpi-value num">{exported}</span>
          <span className="kpi-note">{t("reports.kpi.exportedNote")}</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">{t("reportStatus.review")}</span>
          <span className="kpi-value num">{review}</span>
          <span className="kpi-note">{t("reports.kpi.reviewNote")}</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">{t("reports.kpi.failed")}</span>
          <span className="kpi-value num">{failed}</span>
          <span className="kpi-note">{t("reports.kpi.failedNote")}</span>
        </div>
      </section>

      <div className="report-tabs" role="tablist" aria-label={t("reports.typeLabel")}>
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`report-tab${tab === item.key ? " is-on" : ""}`}
            onClick={() => setTab(item.key)}
          >
            {t(item.labelKey)}
            <span className="num tab-count">{tabCounts[item.key]}</span>
          </button>
        ))}
      </div>

      {tab === "candidates" ? (
        <section className="card">
          <CardHead
            title={t("reports.candidates.title")}
            meta={t("reports.candidates.meta", { count: rows.length })}
            action={
              <button type="button" className="card-link" onClick={exportCsv}>
                <FileText size={13} aria-hidden="true" />
                {t("reports.candidates.exportCsv")}
              </button>
            }
          />
          {rows.length ? (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("reports.col.candidate")}</th>
                      <th>{t("reports.col.code")}</th>
                      <th>{t("reports.col.position")}</th>
                      <th className="num">{t("reports.col.version")}</th>
                      <th>{t("reports.col.reviewer")}</th>
                      <th className="num">{t("reports.col.created")}</th>
                      <th>{t("reports.col.status")}</th>
                      <th aria-label={t("reports.col.download")} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 6).map((row) => (
                      <tr key={row.id}>
                        <td className="c-name">
                          <a
                            href={`#candidate/${row.candidateId}`}
                            className="row-name"
                            onClick={(event) => {
                              event.preventDefault();
                              go("candidate", row.candidateId);
                            }}
                          >
                            {row.candidate}
                          </a>
                        </td>
                        <td className="c-code mono" data-label={t("reports.col.code")}>
                          {row.id}
                        </td>
                        <td className="c-role" data-label={t("reports.col.position")}>
                          {row.position}
                        </td>
                        <td className="num mono" data-label={t("reports.col.version")}>
                          v{row.version}
                        </td>
                        <td className="c-reviewer" data-label={t("reports.col.reviewer")}>
                          {row.reviewer}
                        </td>
                        <td className="num c-updated" data-label={t("reports.col.created")}>
                          {row.created}
                        </td>
                        <td className="c-status" data-label={t("reports.col.status")}>
                          <span className={`pill ${reportStatusMeta[row.status].className}`}>
                            {t(reportStatusMeta[row.status].labelKey)}
                          </span>
                        </td>
                        <td className="c-go">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t("reports.downloadAria", {
                              name: row.candidate,
                            })}
                            onClick={() => void exportRow(row)}
                          >
                            <Download size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card-foot">
                <span className="foot-note">
                  {t("reports.candidates.foot", {
                    shown: Math.min(6, rows.length),
                    total: rows.length,
                  })}
                </span>
                <button
                  type="button"
                  className="card-link"
                  onClick={() => go("candidates")}
                >
                  {t("reports.candidates.openList")}
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : (
            <EmptyState
              title={t("reports.candidates.emptyTitle")}
              detail={t("reports.candidates.emptyDetail")}
              action={
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setRange("30")}
                >
                  {t("reports.candidates.emptyAction")}
                </button>
              }
            />
          )}
        </section>
      ) : null}

      {tab === "distribution" ? (
        <div className="reports-grid">
          <section className="card">
            <CardHead
              title={t("reports.distribution.statusTitle")}
              meta={t("reports.distribution.statusMeta", {
                count: stats.total,
              })}
            />
            <div className="bar-list">
              {statusOrder.map((status) => {
                const count = candidateList.filter(
                  (c) => c.status === status,
                ).length;
                return (
                  <div className="bar-row" key={status}>
                    <div className="bar-top">
                      <span className="bar-label">
                        {t(statusMeta[status].labelKey)}
                      </span>
                      <span className="bar-value num">{count}</span>
                    </div>
                    <div className="bar-track">
                      <span
                        className="bar-fill"
                        style={{
                          width: `${Math.max((count / maxStatus) * 100, count ? 2 : 0)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="card-foot">
              <span className="foot-note">
                {t("reports.distribution.statusFoot", {
                  count: candidateList.length,
                })}
              </span>
            </div>
          </section>

          <section className="card">
            <CardHead
              title={t("reports.distribution.positionTitle")}
              meta={t("reports.distribution.positionMeta", {
                positions: livePositions.length,
                count: positionTotal,
              })}
            />
            <div className="bar-list">
              {shownPositions.length === 0 ? (
                <EmptyState
                  title={t("reports.distribution.positionEmptyTitle")}
                  detail={t("reports.distribution.positionEmptyDetail")}
                />
              ) : (
                shownPositions.map((position, index) => (
                  <div className="bar-row" key={position.id}>
                    <div className="bar-top">
                      <span className="bar-label">{position.title}</span>
                      <span className="bar-value num">{position.liveCount}</span>
                    </div>
                    <div className="bar-track">
                      <span
                        className={`bar-fill${index === 0 ? " is-lead" : ""}`}
                        style={{
                          width: `${(position.liveCount / maxPosition) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="card-foot">
              <span className="foot-note">
                {hiddenPositions > 0
                  ? t("reports.distribution.positionMore", {
                      count: hiddenPositions,
                    })
                  : t("reports.distribution.positionFoot", {
                      count: positionTotal,
                    })}
              </span>
            </div>
          </section>
        </div>
      ) : null}

      {tab === "quality" ? (
        <div className="reports-grid">
          <section className="card">
            <CardHead
              title={t("reports.quality.title")}
              meta={t("reports.quality.meta", { count: positionList.length })}
            />
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("reports.col.position")}</th>
                    <th>{t("reports.col.team")}</th>
                    <th className="num">{t("reports.col.criteria")}</th>
                    <th className="num">{t("reports.col.must")}</th>
                    <th className="num">{t("reports.col.candidates")}</th>
                  </tr>
                </thead>
                <tbody>
                  {positionList.map((position) => (
                    <tr key={position.id}>
                      <td className="c-name">
                        <span className="row-name">{position.title}</span>
                      </td>
                      <td className="c-role" data-label={t("reports.col.team")}>
                        {position.team}
                      </td>
                      <td className="num fig" data-label={t("reports.col.criteria")}>
                        {position.criteria.length}
                      </td>
                      <td className="num fig" data-label={t("reports.col.must")}>
                        {position.criteria.filter((c) => c.kind === "must").length}
                      </td>
                      <td className="num fig" data-label={t("reports.col.candidates")}>
                        {position.candidateCount ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-foot">
              <span className="foot-note">{t("reports.quality.foot")}</span>
            </div>
          </section>

          <section className="card">
            <CardHead
              title={t("reports.quality.weakTitle")}
              meta={t("reports.quality.weakMeta", {
                count: weakPositions.length,
              })}
            />
            <ul className="flag-list">
              {weakPositions.map((position) => (
                <li key={position.id}>
                  <span className="flag-main">
                    <span className="flag-title">{position.title}</span>
                    <span className="flag-sub">
                      {t("reports.quality.weakSub", {
                        criteria: position.criteria.length,
                        candidates: position.candidateCount ?? 0,
                      })}
                    </span>
                  </span>
                  <span className="pill pill-warning">
                    {t("reports.quality.weakPill")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="card-foot">
              <span className="foot-note">{t("reports.quality.weakFoot")}</span>
              <button
                type="button"
                className="card-link"
                onClick={() => go("jobs")}
              >
                {t("reports.quality.openJobs")}
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
