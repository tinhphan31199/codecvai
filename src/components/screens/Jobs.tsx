"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Plus,
  Users,
  X,
} from "lucide-react";
import type { Position, Screen } from "@/data/codecv";
import { createPosition, useLevels, usePositions } from "@/lib/api";
import {
  EmptyState,
  LoadError,
  PageHead,
  ScreenLoader,
} from "../ui";

const FALLBACK_LEVELS = ["Junior", "Middle", "Senior"];

export default function Jobs({
  go,
}: {
  go: (screen: Screen, id?: string) => void;
}) {
  const { data, loading, error, refetch } = usePositions();
  const { data: levelData } = useLevels();
  const positions = data ?? [];
  const levelOptions = levelData?.length
    ? levelData.map((level) => level.name)
    : FALLBACK_LEVELS;
  const [team, setTeam] = useState("all");
  const [openForm, setOpenForm] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState({
    title: "",
    team: "Product Engineering",
    level: "Middle",
    location: "TP.HCM · Hybrid",
  });

  const levelChoices = levelOptions.includes(draft.level)
    ? levelOptions
    : [draft.level, ...levelOptions];

  const toggleForm = () => {
    if (!openForm && !levelOptions.includes(draft.level)) {
      setDraft((prev) => ({ ...prev, level: levelOptions[0] ?? prev.level }));
    }
    setOpenForm((value) => !value);
  };

  const teams = Array.from(new Set(positions.map((item) => item.team)));
  const visible =
    team === "all" ? positions : positions.filter((item) => item.team === team);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) return;
    const newPosition: Position = {
      id: `jd-${Date.now()}`,
      title: draft.title.trim(),
      team: draft.team,
      level: draft.level,
      open: "1 vị trí",
      candidates: 0,
      updated: "26/10/2026",
      owner: "Minh Anh",
      location: draft.location,
      description: "Vị trí mới, chưa có mô tả chi tiết.",
      criteria: [],
    };
    try {
      await createPosition(newPosition);
      await refetch();
    } catch {
      // giữ trạng thái form khi tạo thất bại
    }
    setDraft({
      title: "",
      team: "Product Engineering",
      level: levelOptions[0] ?? "Middle",
      location: "TP.HCM · Hybrid",
    });
    setOpenForm(false);
    setTeam("all");
  };

  if (loading && !positions.length) {
    return (
      <ScreenLoader
        title="Job Descriptions"
        label="Đang tải danh sách vị trí…"
      />
    );
  }

  if (error) {
    return (
      <div className="screen">
        <PageHead title="Job Descriptions" />
        <LoadError message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="screen">
      <PageHead
        title="Job Descriptions"
        sub={`${positions.length} vị trí đang mở · ${teams.length} team · tiêu chí dùng chung cho CV và repository.`}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={toggleForm}
          >
            {openForm ? <X size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
            {openForm ? "Đóng form" : "Tạo vị trí"}
          </button>
        }
      />

      {openForm ? (
        <form className="card jd-form" onSubmit={create}>
          <div className="jd-form-head">
            <h2>Tạo vị trí mới</h2>
            <span className="foot-note">
              Tiêu chí có thể bổ sung sau khi tạo.
            </span>
          </div>
          <div className="jd-form-grid">
            <label className="field">
              <span className="field-label">Tên vị trí</span>
              <input
                type="text"
                value={draft.title}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Ví dụ: Staff Backend Engineer"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Team</span>
              <input
                type="text"
                value={draft.team}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, team: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Cấp bậc</span>
              <select
                value={draft.level}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, level: event.target.value }))
                }
              >
                {levelChoices.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Địa điểm</span>
              <input
                type="text"
                value={draft.location}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, location: event.target.value }))
                }
              />
            </label>
          </div>
          <div className="jd-form-actions">
            <button type="submit" className="btn btn-primary" disabled={!draft.title.trim()}>
              <Plus size={15} aria-hidden="true" />
              Tạo vị trí
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => setOpenForm(false)}
            >
              Hủy
            </button>
          </div>
        </form>
      ) : null}

      <div className="filter-row jobs-filter">
        <div className="chip-group" role="group" aria-label="Lọc theo team">
          <button
            type="button"
            className={`chip${team === "all" ? " is-on" : ""}`}
            aria-pressed={team === "all"}
            onClick={() => setTeam("all")}
          >
            Tất cả <span className="num">{positions.length}</span>
          </button>
          {teams.map((item) => (
            <button
              key={item}
              type="button"
              className={`chip${team === item ? " is-on" : ""}`}
              aria-pressed={team === item}
              onClick={() => setTeam(item)}
            >
              {item}{" "}
              <span className="num">
                {positions.filter((position) => position.team === item).length}
              </span>
            </button>
          ))}
        </div>
        <span className="result-count">
          <strong className="num">{visible.length}</strong> vị trí
        </span>
      </div>

      {visible.length ? (
        <div className="jd-grid">
          {visible.map((position) => {
            const open = Boolean(expanded[position.id]);
            return (
              <article className="card jd-card" key={position.id}>
                <div className="jd-head">
                  <div className="jd-title-wrap">
                    <h2>{position.title}</h2>
                    <span className="jd-meta">
                      {position.team} · {position.level}
                    </span>
                  </div>
                  <span className="pill pill-positive">Đang mở</span>
                </div>
                <p className="jd-desc">{position.description}</p>
                <div className="jd-facts">
                  <span>
                    <MapPin size={13} aria-hidden="true" />
                    {position.location}
                  </span>
                  <span>
                    <Users size={13} aria-hidden="true" />
                    {position.candidates} ứng viên
                  </span>
                  <span>{position.open}</span>
                </div>

                <div className="jd-criteria">
                  <button
                    type="button"
                    className="jd-expand"
                    aria-expanded={open}
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [position.id]: !prev[position.id],
                      }))
                    }
                  >
                    <span>
                      Tiêu chí tuyển dụng{" "}
                      <span className="num">({position.criteria.length})</span>
                    </span>
                    <ChevronDown
                      size={15}
                      className={open ? "rotate-180" : undefined}
                      aria-hidden="true"
                    />
                  </button>
                  {open ? (
                    position.criteria.length ? (
                      <ul className="jd-criteria-list">
                        {position.criteria.map((criterion) => (
                          <li key={criterion.label}>
                            <span className="jd-crit-label">
                              {criterion.label}
                            </span>
                            <span className="jd-crit-meta">
                              {criterion.kind === "must" ? "Bắt buộc" : "Ưu tiên"}{" "}
                              · trọng số {criterion.weight} · {criterion.verify}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="jd-empty">
                        Chưa có tiêu chí. Bổ sung trước khi phân tích CV.
                      </p>
                    )
                  ) : null}
                </div>

                <div className="jd-foot">
                  <span className="foot-note">
                    {position.owner} · cập nhật {position.updated}
                  </span>
                  <button
                    type="button"
                    className="card-link"
                    onClick={() => go("candidates")}
                  >
                    Xem ứng viên
                    <ChevronRight size={13} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            title="Không có vị trí trong team này"
            detail="Chọn team khác hoặc tạo vị trí mới."
          />
        </div>
      )}

      <p className="screen-note">
        Mỗi vị trí dùng cùng một bộ tiêu chí để đối chiếu CV và repository, nhờ đó
        bằng chứng giữa các ứng viên có thể so sánh được.
      </p>
    </div>
  );
}
