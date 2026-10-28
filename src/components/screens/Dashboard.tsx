"use client";

import {
  ArrowRight,
  ChevronRight,
  RefreshCw,
  UploadCloud,
} from "lucide-react";
import type { Screen } from "@/data/codecv";
import { candidateEvidence, STAGES } from "@/data/codecv";
import { useDashboard } from "@/lib/api";
import {
  Avatar,
  CardHead,
  EvidenceMeter,
  LoadError,
  PageHead,
  ScreenLoader,
  StageLadder,
  StatusPill,
} from "../ui";

const stageDetail = [
  "Đang đọc CV.pdf",
  "Đang trích xuất nội dung CV",
  "Đang so khớp tiêu chí JD",
  "Đang phân tích repository",
  "Đang tạo câu hỏi phỏng vấn",
  "Đang tạo báo cáo",
];

export default function Dashboard({
  go,
  teamName,
}: {
  go: (screen: Screen, id?: string) => void;
  teamName: string;
}) {
  const { data, loading, error, refetch } = useDashboard();

  if (loading) {
    return <ScreenLoader title="Dashboard" />;
  }

  if (error || !data) {
    return (
      <div className="screen">
        <PageHead title="Dashboard" sub={teamName} />
        <LoadError message={error ?? "Không có dữ liệu."} onRetry={refetch} />
      </div>
    );
  }

  const { workspace, review, processing, recent, positions } = data;
  const topPositions = positions.slice(0, 5);

  return (
    <div className="screen">
      <PageHead
        title="Dashboard"
        sub={`${teamName} · Thứ Hai, 26/10/2026 · ${workspace.total} hồ sơ trong workspace`}
        actions={
          <>
            <span className="stamp">
              <RefreshCw size={13} aria-hidden="true" />
              Cập nhật {workspace.updated}
            </span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => go("upload")}
            >
              <UploadCloud size={15} aria-hidden="true" />
              Phân tích CV mới
            </button>
          </>
        }
      />

      <section className="kpi-strip" aria-label="Tổng quan hoạt động">
        <div className="kpi-cell">
          <span className="kpi-label">Tổng ứng viên</span>
          <span className="kpi-value num">{workspace.total}</span>
          <span className="kpi-note">8 vị trí đang mở</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">Đang phân tích</span>
          <span className="kpi-value num">{workspace.processing}</span>
          <span className="kpi-note">Tiến độ theo từng công đoạn</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">Báo cáo hoàn tất</span>
          <span className="kpi-value num">{workspace.completed}</span>
          <span className="kpi-note">Sẵn sàng để đọc và xuất</span>
        </div>
        <div className="kpi-cell">
          <span className="kpi-label">Chờ review</span>
          <span className="kpi-value num">{workspace.review}</span>
          <span className="kpi-note">2 hồ sơ chờ hơn 24 giờ</span>
        </div>
      </section>

      <div className="overview-grid">
        <section className="card">
          <CardHead
            title="Chờ bạn review"
            meta={`${workspace.review} hồ sơ · 2 hồ sơ chờ hơn 24 giờ`}
            action={
              <button
                type="button"
                className="card-link"
                onClick={() => go("candidates")}
              >
                Xem tất cả
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            }
          />
          <div className="queue-list">
            {review.map((candidate) => {
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
                      {candidate.position} · cập nhật {candidate.updated}
                    </span>
                    <div className="queue-evidence">
                      <EvidenceMeter
                        verified={ev.verified}
                        inferred={ev.inferred}
                        missing={ev.missing}
                        total={ev.total}
                      />
                      <span className="evidence-text">
                        {ev.covered}/{ev.total} tiêu chí có bằng chứng ·{" "}
                        {ev.missing} cần xác minh
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="row-go"
                    aria-label={`Mở hồ sơ ${candidate.name}`}
                    onClick={() => go("candidate", candidate.id)}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="card-foot">
            <span className="foot-note">
              Hồ sơ chờ review lâu nhất: Lâm Tuấn Kiệt · 2 ngày
            </span>
            <button
              type="button"
              className="card-link"
              onClick={() => go("candidates")}
            >
              Mở hàng đợi
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="card">
          <CardHead
            title="Đang phân tích"
            meta={`${workspace.processing} hồ sơ · cập nhật theo công đoạn`}
            action={
              <button
                type="button"
                className="card-link"
                onClick={() => go("candidates")}
              >
                Xem tiến độ
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            }
          />
          <div className="progress-list">
            {processing.map((candidate) => {
              const step = candidate.stageIndex ?? 0;
              const stage = STAGES[step] ?? STAGES[0];
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
                      {candidate.role} · {stage}
                    </span>
                    <StageLadder step={step} labels={false} />
                  </span>
                  <span className="progress-side">
                    <span className="progress-step num">
                      {step + 1}/6
                    </span>
                    <span className="progress-detail">
                      {stageDetail[step] ?? "Đang chạy"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="card-foot">
            <span className="foot-note">
              Tiến độ hiển thị theo công đoạn, không phải phần trăm ước lượng.
            </span>
          </div>
        </section>
      </div>

      <div className="overview-grid overview-grid-lower">
        <section className="card">
          <CardHead
            title="Ứng viên gần đây"
            meta={`${recent.length} hồ sơ mới nhất`}
            action={
              <button
                type="button"
                className="card-link"
                onClick={() => go("candidates")}
              >
                Xem tất cả
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            }
          />
          <div className="table-wrap">
            <table className="table table-recent">
              <thead>
                <tr>
                  <th>Ứng viên</th>
                  <th>Vị trí</th>
                  <th className="num">Bằng chứng</th>
                  <th>Trạng thái</th>
                  <th className="num">Cập nhật</th>
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
                            <span className="person-sub">{candidate.email}</span>
                          </span>
                        </div>
                      </td>
                      <td className="c-role" data-label="Vị trí">
                        {candidate.position}
                      </td>
                      <td className="num c-evidence fig" data-label="Bằng chứng">
                        {ev.covered}/{ev.total}
                      </td>
                      <td className="c-status" data-label="Trạng thái">
                        <StatusPill status={candidate.status} />
                      </td>
                      <td className="num c-updated" data-label="Cập nhật">
                        {candidate.updated}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <CardHead
            title="Hồ sơ theo vị trí"
            meta="Tổng 128 hồ sơ"
            action={
              <button
                type="button"
                className="card-link"
                onClick={() => go("jobs")}
              >
                Vị trí
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            }
          />
          <div className="bar-list">
            {topPositions.map((position, index) => (
              <div className="bar-row" key={position.id}>
                <div className="bar-top">
                  <span className="bar-label">{position.title}</span>
                  <span className="bar-value num">{position.candidates}</span>
                </div>
                <div className="bar-track">
                  <span
                    className={`bar-fill${index === 0 ? " is-lead" : ""}`}
                    style={{ width: `${(position.candidates / 36) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="card-foot">
            <span className="foot-note">+10 hồ sơ ở 3 vị trí khác</span>
          </div>
        </section>
      </div>

      <div className="screen-note">
        <strong>Một phát hiện cần chú ý.</strong> Hai hồ sơ chờ review đã quá 24 giờ;
        ưu tiên mở Lâm Tuấn Kiệt trước để không giữ ứng viên chờ lâu.
      </div>
    </div>
  );
}
