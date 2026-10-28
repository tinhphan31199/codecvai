"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import type { CriterionKind, Position } from "@/data/codecv";
import {
  createPosition,
  deletePosition,
  updatePosition,
  useLevels,
  usePositions,
} from "@/lib/api";
import { CardHead, LoadError, Loading } from "../../ui";
import { ConfirmDelete, FormStatus, RowActions } from "./shared";

type CriterionDraft = {
  label: string;
  kind: CriterionKind;
  weight: number;
  verify: string;
};

type Draft = {
  title: string;
  team: string;
  level: string;
  open: string;
  location: string;
  owner: string;
  description: string;
  candidates: number;
  updated: string;
  criteria: CriterionDraft[];
};

const EMPTY: Draft = {
  title: "",
  team: "Product Engineering",
  level: "Middle",
  open: "1 vị trí",
  location: "TP.HCM · Hybrid",
  owner: "Minh Anh",
  description: "",
  candidates: 0,
  updated: new Date().toLocaleDateString("vi-VN"),
  criteria: [],
};

const FALLBACK_LEVELS = ["Junior", "Middle", "Senior"];

function toDraft(position: Position): Draft {
  return {
    title: position.title,
    team: position.team,
    level: position.level || "Middle",
    open: position.open,
    location: position.location,
    owner: position.owner,
    description: position.description,
    candidates: position.candidates,
    updated: position.updated || new Date().toLocaleDateString("vi-VN"),
    criteria: position.criteria.map((criterion) => ({ ...criterion })),
  };
}

export default function PositionsTab() {
  const { data, loading, error, refetch } = usePositions();
  const { data: levelData } = useLevels();
  const positions = data ?? [];
  const levelOptions = levelData?.length
    ? levelData.map((level) => level.name)
    : FALLBACK_LEVELS;
  const [editing, setEditing] = useState<Position | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirming, setConfirming] = useState<Position | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const levelChoices =
    draft.level && !levelOptions.includes(draft.level)
      ? [draft.level, ...levelOptions]
      : levelOptions;

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...EMPTY, level: levelOptions[0], criteria: [] });
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const openEdit = (position: Position) => {
    setEditing(position);
    setDraft(toDraft(position));
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const patchDraft = (patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const patchCriterion = (index: number, patch: Partial<CriterionDraft>) => {
    setDraft((prev) => ({
      ...prev,
      criteria: prev.criteria.map((criterion, idx) =>
        idx === index ? { ...criterion, ...patch } : criterion,
      ),
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    const position: Position = {
      id: editing?.id ?? `jd-${Date.now()}`,
      title,
      team: draft.team.trim(),
      level: draft.level,
      open: draft.open.trim(),
      candidates: Math.max(0, draft.candidates),
      updated: draft.updated.trim(),
      owner: draft.owner.trim(),
      location: draft.location.trim(),
      description: draft.description.trim(),
      criteria: draft.criteria
        .filter((criterion) => criterion.label.trim())
        .map((criterion) => ({
          label: criterion.label.trim(),
          kind: criterion.kind,
          weight: Number.isFinite(criterion.weight) ? criterion.weight : 0,
          verify: criterion.verify.trim(),
        })),
    };
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      if (editing) {
        await updatePosition(position);
        setNote(`Đã cập nhật ${position.title}.`);
      } else {
        await createPosition(position);
        setNote(`Đã tạo ${position.title}.`);
      }
      setFormOpen(false);
      setEditing(null);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không lưu được vị trí.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (position: Position) => {
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      await deletePosition(position.id);
      if (editing?.id === position.id) {
        setFormOpen(false);
        setEditing(null);
      }
      setConfirming(null);
      setNote(`Đã xoá ${position.title}.`);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không xoá được vị trí.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead
        title="Vị trí & tiêu chí"
        meta={`${positions.length} vị trí · positions + position_criteria`}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCreate}>
            <Plus size={14} aria-hidden="true" />
            Thêm vị trí
          </button>
        }
      />

      {formError || note ? (
        <div className="crud-toolbar">
          <FormStatus error={formError} note={note} />
        </div>
      ) : null}

      {formOpen ? (
        <form className="crud-form" onSubmit={submit}>
          <div className="crud-grid">
            <label className="field is-span-2">
              <span className="field-label">Tên vị trí</span>
              <input
                type="text"
                value={draft.title}
                onChange={(event) => patchDraft({ title: event.target.value })}
                placeholder="Ví dụ: Staff Backend Engineer"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Team</span>
              <input
                type="text"
                value={draft.team}
                onChange={(event) => patchDraft({ team: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Cấp bậc</span>
              <select
                value={draft.level}
                onChange={(event) => patchDraft({ level: event.target.value })}
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
                onChange={(event) => patchDraft({ location: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Owner</span>
              <input
                type="text"
                value={draft.owner}
                onChange={(event) => patchDraft({ owner: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Số lượng tuyển</span>
              <input
                type="text"
                value={draft.open}
                onChange={(event) => patchDraft({ open: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Ứng viên hiện có</span>
              <input
                type="number"
                min={0}
                value={draft.candidates}
                onChange={(event) =>
                  patchDraft({ candidates: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Cập nhật</span>
              <input
                type="text"
                value={draft.updated}
                onChange={(event) => patchDraft({ updated: event.target.value })}
              />
            </label>
            <label className="field is-span-full">
              <span className="field-label">Mô tả</span>
              <textarea
                rows={2}
                value={draft.description}
                onChange={(event) =>
                  patchDraft({ description: event.target.value })
                }
              />
            </label>
          </div>

          <div className="criteria-editor">
            <div className="criteria-editor-head">
              <span>
                Tiêu chí tuyển dụng{" "}
                <span className="num">({draft.criteria.length})</span>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  patchDraft({
                    criteria: [
                      ...draft.criteria,
                      { label: "", kind: "must", weight: 10, verify: "" },
                    ],
                  })
                }
              >
                <Plus size={13} aria-hidden="true" />
                Thêm tiêu chí
              </button>
            </div>
            {draft.criteria.length ? (
              draft.criteria.map((criterion, index) => (
                <div className="criteria-row" key={index}>
                  <label className="field">
                    <span className="field-label">Tiêu chí</span>
                    <input
                      type="text"
                      value={criterion.label}
                      onChange={(event) =>
                        patchCriterion(index, { label: event.target.value })
                      }
                      placeholder="Ví dụ: Kinh nghiệm thiết kế hệ thống"
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Loại</span>
                    <select
                      value={criterion.kind}
                      onChange={(event) =>
                        patchCriterion(index, {
                          kind: event.target.value as CriterionKind,
                        })
                      }
                    >
                      <option value="must">Bắt buộc</option>
                      <option value="nice">Ưu tiên</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Trọng số</span>
                    <input
                      type="number"
                      min={0}
                      value={criterion.weight}
                      onChange={(event) =>
                        patchCriterion(index, {
                          weight: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Cách xác minh</span>
                    <input
                      type="text"
                      value={criterion.verify}
                      onChange={(event) =>
                        patchCriterion(index, { verify: event.target.value })
                      }
                      placeholder="CV, repository, phỏng vấn…"
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Xoá tiêu chí ${index + 1}`}
                    title="Xoá tiêu chí"
                    onClick={() =>
                      patchDraft({
                        criteria: draft.criteria.filter(
                          (_item, idx) => idx !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            ) : (
              <p className="crud-note">
                Chưa có tiêu chí. Tiêu chí dùng chung cho đối chiếu CV và
                repository.
              </p>
            )}
          </div>

          <div className="crud-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={15} aria-hidden="true" />
              ) : (
                <Check size={15} aria-hidden="true" />
              )}
              {editing ? "Lưu thay đổi" : "Tạo vị trí"}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
              disabled={busy}
            >
              <X size={15} aria-hidden="true" />
              Hủy
            </button>
          </div>
        </form>
      ) : null}

      {loading && !positions.length ? (
        <Loading label="Đang tải vị trí…" />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Vị trí</th>
                <th>Địa điểm</th>
                <th className="num">Ứng viên</th>
                <th className="num">Tiêu chí</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.id}>
                  <td className="c-name">
                    <span className="person-main">
                      <span className="row-name">{position.title}</span>
                      <span className="person-sub">
                        {position.team || "—"} · {position.level || "—"}
                      </span>
                    </span>
                  </td>
                  <td data-label="Địa điểm">{position.location || "—"}</td>
                  <td className="num" data-label="Ứng viên">
                    {position.candidates}
                  </td>
                  <td className="num" data-label="Tiêu chí">
                    {position.criteria.length}
                  </td>
                  <td className="c-go">
                    <RowActions
                      editLabel={`Sửa ${position.title}`}
                      deleteLabel={`Xoá ${position.title}`}
                      onEdit={() => openEdit(position)}
                      onDelete={() => {
                        setConfirming(position);
                        setFormError(null);
                        setNote(null);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirming ? (
        <ConfirmDelete
          message={`Xoá vị trí ${confirming.title}? Hồ sơ ứng viên vẫn giữ tên vị trí dạng văn bản.`}
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      <p className="crud-note">
        Vị trí tạo ở đây được dùng ngay khi phân tích CV. Xoá vị trí không xoá
        hồ sơ ứng viên.
      </p>
    </section>
  );
}
