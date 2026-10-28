"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Download, FileText } from "lucide-react";
import type { Screen } from "@/data/codecv";
import { reportStatusMeta, statusMeta } from "@/data/codecv";
import {
  useCandidates,
  usePositions,
  useReports,
  useWorkspace,
} from "@/lib/api";
import { CardHead, EmptyState, LoadError, PageHead, ScreenLoader } from "../ui";

type ReportTab = "candidates" | "distribution" | "quality";

const tabs: { key: ReportTab; label: string }[] = [
  { key: "candidates", label: "Báo cáo ứng viên" },
  { key: "distribution", label: "Phân bố hồ sơ" },
  { key: "quality", label: "Chất lượng JD" },
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
  const workspace = useWorkspace();
  const {
    data: reports,
    loading: reportsLoading,
    error: reportsError,
    refetch: refetchReports,
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
    return <ScreenLoader title="Reports" label="Đang tải báo cáo…" />;
  }

  if (error) {
    return (
      <div className="screen">
        <PageHead title="Reports" />
        <LoadError message={error} onRetry={refetchAll} />
      </div>
    );
  }

  const rows = reportList.filter((row) =>
    range === "today" ? row.created.startsWith("26/10/2026") : true,
  );

  const tabCounts: Record<ReportTab, number> = {
    candidates: reportList.length,
    distribution: positionList.length,
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
      "Mã",
      "Ứng viên",
      "Vị trí",
      "Phiên bản",
      "Người review",
      "Ngày tạo",
      "Trạng thái",
    ];
    const lines = rows.map((row) =>
      [
        row.id,
        row.candidate,
        row.position,
        `v${row.version}`,
        row.reviewer,
        row.created,
        reportStatusMeta[row.status].label,
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

  const exportRow = (candidateId: string) => {
    const candidate = candidateById.get(candidateId);
    if (!candidate) return;
    const content = [
      `# Báo cáo ứng viên — ${candidate.name}`,
      "",
      `${candidate.position} · ${candidate.level} · ${candidate.location}`,
      "",
      "## Tóm tắt",
      candidate.summary,
      "",
      "## Bằng chứng",
      ...candidate.criteria.map(
        (item) =>
          `- ${item.label}: ${item.state === "verified" ? "Đã xác minh" : item.state === "inferred" ? "Suy luận" : "Chưa đủ dữ liệu"} (${item.evidence})`,
      ),
      "",
      `Nguồn: ${candidate.source}`,
    ].join("\n");
    download(
      `CodeCV_report_${candidate.id}.md`,
      content,
      "text/markdown;charset=utf-8",
    );
  };

  const maxStatus = Math.max(
    0,
    ...statusOrder.map(
      (status) => candidateList.filter((c) => c.status === status).length,
    ),
  );
  const maxPosition = Math.max(0, ...positionList.map((p) => p.candidates));
  const weakPositions = positionList.filter((p) => p.criteria.length < 4);

  return (
    <div className="screen">
      <PageHead
        title="Reports"
        sub={`Báo cáo ứng viên, phân bố hồ sơ và chất lượng JD · cập nhật ${workspace.updated}`}
        actions={
          <>
            <label className="filter-select">
              <span className="visually-hidden">Khoảng thời gian</span>
              <select
                value={range}
                onChange={(event) => setRange(event.target.value)}
              >
                <option value="today">Hôm nay · 26/10</option>
                <option value="7">7 ngày qua</option>
                <option value="30">30 ngày qua</option>
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={exportCsv}>
              <Download size={15} aria-hidden="true" />
              Xuất báo cáo
            </button>
          </>
        }
      />

      <section className="kpi-strip" aria-label="Tổng quan báo cáo">
        <div className="kpi-cell">
          <span className="kpi-label">Báo cáo trong kỳ</span>
          <span className="kpi-value num">{rows.length}</span>
          <span className="kpi-note">{rows.length} phiên bản đã tạo</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">Đã xuất</span>
          <span className="kpi-value num">{exported}</span>
          <span className="kpi-note">Sẵn sàng chia sẻ với team</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">Chờ review</span>
          <span className="kpi-value num">{review}</span>
          <span className="kpi-note">Cần người review xác nhận</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">Lỗi tạo báo cáo</span>
          <span className="kpi-value num">{failed}</span>
          <span className="kpi-note">Cần cấp lại quyền repository</span>
        </div>
      </section>

      <div className="report-tabs" role="tablist" aria-label="Loại báo cáo">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`report-tab${tab === item.key ? " is-on" : ""}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
            <span className="num tab-count">{tabCounts[item.key]}</span>
          </button>
        ))}
      </div>

      {tab === "candidates" ? (
        <section className="card">
          <CardHead
            title="Báo cáo ứng viên gần nhất"
            meta={`${rows.length} báo cáo trong kỳ`}
            action={
              <button type="button" className="card-link" onClick={exportCsv}>
                <FileText size={13} aria-hidden="true" />
                Xuất CSV
              </button>
            }
          />
          {rows.length ? (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ứng viên</th>
                      <th>Mã báo cáo</th>
                      <th>Vị trí</th>
                      <th className="num">Phiên bản</th>
                      <th>Người review</th>
                      <th className="num">Ngày tạo</th>
                      <th>Trạng thái</th>
                      <th aria-label="Tải báo cáo" />
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
                        <td className="c-code mono" data-label="Mã báo cáo">
                          {row.id}
                        </td>
                        <td className="c-role" data-label="Vị trí">
                          {row.position}
                        </td>
                        <td className="num mono" data-label="Phiên bản">
                          v{row.version}
                        </td>
                        <td className="c-reviewer" data-label="Người review">
                          {row.reviewer}
                        </td>
                        <td className="num c-updated" data-label="Ngày tạo">
                          {row.created}
                        </td>
                        <td className="c-status" data-label="Trạng thái">
                          <span className={`pill ${reportStatusMeta[row.status].className}`}>
                            {reportStatusMeta[row.status].label}
                          </span>
                        </td>
                        <td className="c-go">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Tải báo cáo của ${row.candidate}`}
                            onClick={() => exportRow(row.candidateId)}
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
                  Hiển thị {Math.min(6, rows.length)}/{rows.length} báo cáo gần
                  nhất trong kỳ.
                </span>
                <button
                  type="button"
                  className="card-link"
                  onClick={() => go("candidates")}
                >
                  Mở danh sách ứng viên
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : (
            <EmptyState
              title="Không có báo cáo trong khoảng thời gian này"
              detail="Chọn khoảng thời gian rộng hơn để xem báo cáo đã tạo."
              action={
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setRange("30")}
                >
                  Xem 30 ngày qua
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
              title="Phân bố theo trạng thái"
              meta={`${workspace.total} hồ sơ · toàn workspace`}
            />
            <div className="bar-list">
              {statusOrder.map((status) => {
                const count = candidateList.filter(
                  (c) => c.status === status,
                ).length;
                return (
                  <div className="bar-row" key={status}>
                    <div className="bar-top">
                      <span className="bar-label">{statusMeta[status].label}</span>
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
                Phân bố theo {candidateList.length} hồ sơ trong workspace.
              </span>
            </div>
          </section>

          <section className="card">
            <CardHead
              title="Hồ sơ theo vị trí"
              meta={`${positionList.length} vị trí · ${positionList.reduce((sum, p) => sum + p.candidates, 0)} hồ sơ`}
            />
            <div className="bar-list">
              {positionList.map((position) => (
                <div className="bar-row" key={position.id}>
                  <div className="bar-top">
                    <span className="bar-label">{position.title}</span>
                    <span className="bar-value num">{position.candidates}</span>
                  </div>
                  <div className="bar-track">
                    <span
                      className="bar-fill"
                      style={{ width: `${(position.candidates / maxPosition) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="card-foot">
              <span className="foot-note">
                Tổng khớp {workspace.total} hồ sơ trong workspace.
              </span>
            </div>
          </section>
        </div>
      ) : null}

      {tab === "quality" ? (
        <div className="reports-grid">
          <section className="card">
            <CardHead
              title="Tiêu chí theo vị trí"
              meta={`${positionList.length} JD · nguồn xác minh`}
            />
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Vị trí</th>
                    <th>Team</th>
                    <th className="num">Tiêu chí</th>
                    <th className="num">Bắt buộc</th>
                    <th className="num">Ứng viên</th>
                  </tr>
                </thead>
                <tbody>
                  {positionList.map((position) => (
                    <tr key={position.id}>
                      <td className="c-name">
                        <span className="row-name">{position.title}</span>
                      </td>
                      <td className="c-role" data-label="Team">
                        {position.team}
                      </td>
                      <td className="num fig" data-label="Tiêu chí">
                        {position.criteria.length}
                      </td>
                      <td className="num fig" data-label="Bắt buộc">
                        {position.criteria.filter((c) => c.kind === "must").length}
                      </td>
                      <td className="num fig" data-label="Ứng viên">
                        {position.candidates}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-foot">
              <span className="foot-note">
                Mọi tiêu chí đều có nguồn xác minh: CV, repository hoặc phỏng vấn.
              </span>
            </div>
          </section>

          <section className="card">
            <CardHead
              title="Vị trí cần bổ sung tiêu chí"
              meta={`${weakPositions.length} vị trí dưới 4 tiêu chí`}
            />
            <ul className="flag-list">
              {weakPositions.map((position) => (
                <li key={position.id}>
                  <span className="flag-main">
                    <span className="flag-title">{position.title}</span>
                    <span className="flag-sub">
                      {position.criteria.length} tiêu chí · {position.candidates} ứng
                      viên
                    </span>
                  </span>
                  <span className="pill pill-warning">Cần bổ sung</span>
                </li>
              ))}
            </ul>
            <div className="card-foot">
              <span className="foot-note">
                Thêm tiêu chí và nguồn xác minh trước khi mở phân tích hàng loạt.
              </span>
              <button
                type="button"
                className="card-link"
                onClick={() => go("jobs")}
              >
                Mở Job Descriptions
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
