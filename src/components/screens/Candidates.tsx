"use client";

import { useState } from "react";
import {
  ChevronRight,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import type { CandidateStatus, Screen } from "@/data/codecv";
import { candidateEvidence, statusMeta } from "@/data/codecv";
import {
  useCandidatesPage,
  useDebouncedValue,
  useStats,
} from "@/lib/api";
import { useT, type MessageKey } from "@/lib/i18n";
import {
  Avatar,
  EmptyState,
  EvidenceMeter,
  LoadError,
  PageHead,
  Pager,
  ScreenLoader,
  StatusPill,
} from "../ui";

const PAGE_SIZE = 8;

const statusOptions: { value: CandidateStatus | "all"; labelKey: MessageKey }[] = [
  { value: "all", labelKey: "candidates.statusAll" },
  { value: "completed", labelKey: statusMeta.completed.labelKey },
  { value: "review", labelKey: statusMeta.review.labelKey },
  { value: "processing", labelKey: statusMeta.processing.labelKey },
  { value: "failed", labelKey: statusMeta.failed.labelKey },
  { value: "archived", labelKey: statusMeta.archived.labelKey },
];

export default function Candidates({
  go,
  query,
  setQuery,
}: {
  go: (screen: Screen, id?: string) => void;
  query: string;
  setQuery: (value: string) => void;
}) {
  const stats = useStats();
  const t = useT();

  const search = query;
  const [status, setStatus] = useState<CandidateStatus | "all">("all");
  const [position, setPosition] = useState("all");
  const [evidence, setEvidence] = useState<"all" | "verified" | "gap">("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: pageData, loading, error, refetch } = useCandidatesPage({
    q: debouncedSearch,
    status,
    position,
    evidence,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  const rows = pageData?.candidates ?? [];
  const total = pageData?.total ?? 0;
  const counts = pageData?.counts ?? { all: 0, verified: 0, gap: 0 };
  const positions = pageData?.positions ?? [];
  const currentPage = pageData?.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (currentPage - 1) * PAGE_SIZE;

  const reset = () => {
    setQuery("");
    setStatus("all");
    setPosition("all");
    setEvidence("all");
    setPage(1);
  };
  const filtered = Boolean(
    search || status !== "all" || position !== "all" || evidence !== "all",
  );

  if (loading && !pageData) {
    return (
      <ScreenLoader
        title={t("screen.candidates")}
        label={t("candidates.loadingLabel")}
      />
    );
  }

  if (error) {
    return (
      <div className="screen">
        <PageHead title={t("screen.candidates")} />
        <LoadError message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="screen">
      <PageHead
        title={t("screen.candidates")}
        sub={t("candidates.sub", {
          total: stats.total,
          shown: rows.length,
        })}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => go("upload")}
          >
            <UploadCloud size={15} aria-hidden="true" />
            {t("candidates.newAnalysis")}
          </button>
        }
      />

      <section className="card">
        <div className="filter-bar">
          <div className="filter-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t("candidates.searchPlaceholder")}
              aria-label={t("candidates.searchAria")}
            />
            {search ? (
              <button
                type="button"
                className="filter-clear"
                aria-label={t("candidates.clearSearchAria")}
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <label className="filter-select">
            <span className="visually-hidden">
              {t("candidates.filterStatusAria")}
            </span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as CandidateStatus | "all");
                setPage(1);
              }}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-select">
            <span className="visually-hidden">
              {t("candidates.filterPositionAria")}
            </span>
            <select
              value={position}
              onChange={(event) => {
                setPosition(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t("candidates.allPositions")}</option>
              {positions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-select">
            <span className="visually-hidden">{t("candidates.sortAria")}</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="recent">{t("candidates.sortRecent")}</option>
              <option value="evidence">{t("candidates.sortEvidence")}</option>
              <option value="name">{t("candidates.sortName")}</option>
            </select>
          </label>
        </div>

        <div className="filter-row">
          <div
            className="chip-group"
            role="group"
            aria-label={t("candidates.filterEvidenceAria")}
          >
            <button
              type="button"
              className={`chip${evidence === "all" ? " is-on" : ""}`}
              aria-pressed={evidence === "all"}
              onClick={() => {
                setEvidence("all");
                setPage(1);
              }}
            >
              {t("candidates.evidenceAll")}{" "}
              <span className="num">{counts.all}</span>
            </button>
            <button
              type="button"
              className={`chip${evidence === "verified" ? " is-on" : ""}`}
              aria-pressed={evidence === "verified"}
              onClick={() => {
                setEvidence("verified");
                setPage(1);
              }}
            >
              {t("candidates.evidenceVerified")}{" "}
              <span className="num">{counts.verified}</span>
            </button>
            <button
              type="button"
              className={`chip${evidence === "gap" ? " is-on" : ""}`}
              aria-pressed={evidence === "gap"}
              onClick={() => {
                setEvidence("gap");
                setPage(1);
              }}
            >
              {t("candidates.evidenceGap")}{" "}
              <span className="num">{counts.gap}</span>
            </button>
          </div>
          <div className="filter-summary">
            {filtered ? (
              <button type="button" className="text-btn" onClick={reset}>
                {t("candidates.clearFilters")}
              </button>
            ) : null}
            <span className="result-count">
              {t("candidates.resultCount", { count: total })}
            </span>
          </div>
        </div>

        {rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table table-candidates">
                <thead>
                  <tr>
                    <th>{t("candidates.colCandidate")}</th>
                    <th>{t("candidates.colPosition")}</th>
                    <th className="num">{t("candidates.colExperience")}</th>
                    <th>{t("candidates.colEvidence")}</th>
                    <th>{t("candidates.colStatus")}</th>
                    <th className="num">{t("candidates.colUpdated")}</th>
                    <th aria-label={t("candidates.colActionAria")} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((candidate) => {
                    const ev = candidateEvidence(candidate);
                    return (
                      <tr key={candidate.id}>
                        <td className="c-name">
                          <div className="person-cell">
                            <Avatar
                              initials={candidate.initials}
                              hue={candidate.hue}
                              size={32}
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
                          data-label={t("candidates.colPosition")}
                        >
                          <span>
                            <span className="role-main">{candidate.position}</span>
                            <span className="role-sub">{candidate.location}</span>
                          </span>
                        </td>
                        <td
                          className="num c-exp"
                          data-label={t("candidates.colExperience")}
                        >
                          <span>
                            <span className="fig">{candidate.years}</span>
                            <span className="unit">
                              {t("candidates.yearsUnit")}
                            </span>
                          </span>
                        </td>
                        <td
                          className="c-evidence-cell"
                          data-label={t("candidates.colEvidence")}
                        >
                          {ev.total ? (
                            <div className="evidence-cell">
                              <div className="evidence-top">
                                <span className="num evidence-count fig">
                                  {ev.covered}/{ev.total}
                                </span>
                              </div>
                              <EvidenceMeter
                                verified={ev.verified}
                                inferred={ev.inferred}
                                missing={ev.missing}
                                total={ev.total}
                              />
                            </div>
                          ) : (
                            <span className="evidence-empty">
                              {t("candidates.evidenceNone")}
                            </span>
                          )}
                        </td>
                        <td
                          className="c-status"
                          data-label={t("candidates.colStatus")}
                        >
                          <StatusPill status={candidate.status} />
                        </td>
                        <td
                          className="num c-updated"
                          data-label={t("candidates.colUpdated")}
                        >
                          {candidate.updated}
                        </td>
                        <td className="c-go">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t("candidates.openProfileAria", {
                              name: candidate.name,
                            })}
                            onClick={() => go("candidate", candidate.id)}
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

            <Pager
              page={currentPage}
              pages={pages}
              info={t("candidates.pageInfo", {
                from: start + 1,
                to: Math.min(start + PAGE_SIZE, total),
                total,
              })}
              prev={t("candidates.prev")}
              next={t("candidates.next")}
              onPage={setPage}
            />
          </>
        ) : (
          <EmptyState
            title={t("candidates.emptyTitle")}
            detail={t("candidates.emptyDetail")}
            action={
              <button type="button" className="btn btn-ghost" onClick={reset}>
                {t("candidates.clearFilters")}
              </button>
            }
          />
        )}

        <div className="card-foot">
          <span className="foot-note">
            {t("candidates.footReview", {
              status: t(statusMeta.review.labelKey),
              review: stats.review,
              shown: total,
            })}
          </span>
          <span className="foot-note">
            {t("candidates.updatedAt", { time: stats.updated })}
          </span>
        </div>
      </section>

      <div className="screen-note">
        <strong>{t("candidates.noteLead")}</strong>{" "}
        {t("candidates.noteBody")}
      </div>
    </div>
  );
}
