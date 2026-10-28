"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import type { CandidateStatus, Screen } from "@/data/codecv";
import { candidateEvidence, statusMeta } from "@/data/codecv";
import { useCandidates, useWorkspace } from "@/lib/api";
import {
  Avatar,
  EmptyState,
  EvidenceMeter,
  LoadError,
  PageHead,
  ScreenLoader,
  StatusPill,
} from "../ui";

const PAGE_SIZE = 8;

const statusOptions: { value: CandidateStatus | "all"; label: string }[] = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "completed", label: statusMeta.completed.label },
  { value: "review", label: statusMeta.review.label },
  { value: "processing", label: statusMeta.processing.label },
  { value: "failed", label: statusMeta.failed.label },
  { value: "archived", label: statusMeta.archived.label },
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
  const workspace = useWorkspace();
  const { data: candidates, loading, error, refetch } = useCandidates();
  const list = useMemo(() => candidates ?? [], [candidates]);

  const search = query;
  const [status, setStatus] = useState<CandidateStatus | "all">("all");
  const [position, setPosition] = useState("all");
  const [evidence, setEvidence] = useState<"all" | "verified" | "gap">("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);

  const positions = useMemo(
    () => Array.from(new Set(list.map((c) => c.position))),
    [list],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = list.filter((candidate) => {
      const ev = candidateEvidence(candidate);
      if (status !== "all" && candidate.status !== status) return false;
      if (position !== "all" && candidate.position !== position) return false;
      if (evidence === "verified" && ev.verified < 2) return false;
      if (evidence === "gap" && ev.missing === 0) return false;
      if (!q) return true;
      return `${candidate.name} ${candidate.email} ${candidate.position} ${candidate.role}`
        .toLowerCase()
        .includes(q);
    });
    if (sort === "evidence") {
      return [...filtered].sort(
        (a, b) =>
          candidateEvidence(b).covered - candidateEvidence(a).covered,
      );
    }
    if (sort === "name") {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }
    return filtered;
  }, [list, query, status, position, evidence, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);

  const verifiedCount = list.filter(
    (c) => candidateEvidence(c).verified >= 2,
  ).length;
  const gapCount = list.filter(
    (c) => candidateEvidence(c).missing > 0,
  ).length;

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

  if (loading) {
    return (
      <ScreenLoader
        title="Candidates"
        label="Đang tải danh sách ứng viên từ máy chủ…"
      />
    );
  }

  if (error) {
    return (
      <div className="screen">
        <PageHead title="Candidates" />
        <LoadError message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="screen">
      <PageHead
        title="Candidates"
        sub={`${workspace.total} hồ sơ trong workspace · ${list.length} hồ sơ đang hiển thị.`}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => go("upload")}
          >
            <UploadCloud size={15} aria-hidden="true" />
            Phân tích CV mới
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
              placeholder="Tìm theo tên, email, vị trí…"
              aria-label="Tìm ứng viên"
            />
            {search ? (
              <button
                type="button"
                className="filter-clear"
                aria-label="Xóa tìm kiếm"
                onClick={() => {
                  setQuery("");
                }}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <label className="filter-select">
            <span className="visually-hidden">Lọc theo trạng thái</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as CandidateStatus | "all");
                setPage(1);
              }}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-select">
            <span className="visually-hidden">Lọc theo vị trí</span>
            <select
              value={position}
              onChange={(event) => {
                setPosition(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Tất cả vị trí</option>
              {positions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-select">
            <span className="visually-hidden">Sắp xếp</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="recent">Cập nhật gần nhất</option>
              <option value="evidence">Nhiều bằng chứng nhất</option>
              <option value="name">Tên A–Z</option>
            </select>
          </label>
        </div>

        <div className="filter-row">
          <div className="chip-group" role="group" aria-label="Lọc theo bằng chứng">
            <button
              type="button"
              className={`chip${evidence === "all" ? " is-on" : ""}`}
              aria-pressed={evidence === "all"}
              onClick={() => {
                setEvidence("all");
                setPage(1);
              }}
            >
              Tất cả <span className="num">{list.length}</span>
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
              Có xác minh <span className="num">{verifiedCount}</span>
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
              Còn thiếu <span className="num">{gapCount}</span>
            </button>
          </div>
          <div className="filter-summary">
            {filtered ? (
              <button type="button" className="text-btn" onClick={reset}>
                Xóa bộ lọc
              </button>
            ) : null}
            <span className="result-count">
              <strong className="num">{rows.length}</strong> hồ sơ
            </span>
          </div>
        </div>

        {visible.length ? (
          <>
            <div className="table-wrap">
              <table className="table table-candidates">
                <thead>
                  <tr>
                    <th>Ứng viên</th>
                    <th>Vị trí</th>
                    <th className="num">Kinh nghiệm</th>
                    <th>Bằng chứng</th>
                    <th>Trạng thái</th>
                    <th className="num">Cập nhật</th>
                    <th aria-label="Mở hồ sơ" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((candidate) => {
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
                        <td className="c-role" data-label="Vị trí">
                          <span>
                            <span className="role-main">{candidate.position}</span>
                            <span className="role-sub">{candidate.location}</span>
                          </span>
                        </td>
                        <td className="num c-exp" data-label="Kinh nghiệm">
                          <span>
                            <span className="fig">{candidate.years}</span>
                            <span className="unit">năm</span>
                          </span>
                        </td>
                        <td className="c-evidence-cell" data-label="Bằng chứng">
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
                        </td>
                        <td className="c-status" data-label="Trạng thái">
                          <StatusPill status={candidate.status} />
                        </td>
                        <td className="num c-updated" data-label="Cập nhật">
                          {candidate.updated}
                        </td>
                        <td className="c-go">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Mở hồ sơ ${candidate.name}`}
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

            <div className="pagination">
              <span className="page-info">
                Hiển thị{" "}
                <strong className="num">
                  {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)}
                </strong>{" "}
                trên <strong className="num">{rows.length}</strong> hồ sơ
              </span>
              <div className="page-controls">
                <button
                  type="button"
                  className="btn btn-quiet"
                  disabled={safePage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                  Trước
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
                  Sau
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="Không có hồ sơ khớp bộ lọc"
            detail="Thử xóa bộ lọc hoặc tìm theo tên, email và vị trí khác."
            action={
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Xóa bộ lọc
              </button>
            }
          />
        )}

        <div className="card-foot">
          <span className="foot-note">
            {statusMeta.review.label}: {workspace.review} hồ sơ trong toàn
            workspace. Danh sách hiển thị {list.length} hồ sơ.
          </span>
          <span className="foot-note">Cập nhật {workspace.updated}</span>
        </div>
      </section>

      <div className="screen-note">
        <strong>Bằng chứng chỉ tính khi có nguồn.</strong> Hồ sơ thiếu bằng
        chứng vẫn hiển thị đầy đủ; mở hồ sơ để xem nguồn từng tiêu chí.
      </div>
    </div>
  );
}
