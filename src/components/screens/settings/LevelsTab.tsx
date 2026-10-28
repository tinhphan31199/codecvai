"use client";

import { useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import {
  createLevel,
  deleteLevel,
  updateLevel,
  useLevels,
  type Level,
} from "@/lib/api";
import { CardHead, LoadError, Loading } from "../../ui";
import { ConfirmDelete, FormStatus, RowActions } from "./shared";

type Draft = { name: string; rank: string };

const EMPTY: Draft = { name: "", rank: "" };

export default function LevelsTab() {
  const { data, loading, error, refetch } = useLevels();
  const levels = data ?? [];
  const [editing, setEditing] = useState<Level | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirming, setConfirming] = useState<Level | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const nextRank = levels.reduce((max, level) => Math.max(max, level.rank), 0) + 1;

  const openCreate = () => {
    setEditing(null);
    setDraft({ name: "", rank: String(nextRank) });
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const openEdit = (level: Level) => {
    setEditing(level);
    setDraft({ name: level.name, rank: String(level.rank) });
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim();
    const rank = Number(draft.rank);
    if (!name) return;
    if (!Number.isInteger(rank)) {
      setFormError("Thứ tự phải là số nguyên.");
      return;
    }
    const level: Level = { name, rank };
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      if (editing) {
        await updateLevel(editing.name, level);
        setNote(
          editing.name !== level.name
            ? `Đã đổi ${editing.name} thành ${level.name} và cập nhật vị trí, hồ sơ liên quan.`
            : `Đã cập nhật cấp bậc ${level.name}.`,
        );
      } else {
        await createLevel(level);
        setNote(`Đã thêm cấp bậc ${level.name}.`);
      }
      setFormOpen(false);
      setEditing(null);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Không lưu được cấp bậc.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (level: Level) => {
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      await deleteLevel(level.name);
      if (editing?.name === level.name) {
        setFormOpen(false);
        setEditing(null);
      }
      setConfirming(null);
      setNote(`Đã xoá cấp bậc ${level.name}.`);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Không xoá được cấp bậc.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead
        title="Cấp bậc"
        meta={`${levels.length} cấp bậc · levels`}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCreate}>
            <Plus size={14} aria-hidden="true" />
            Thêm cấp bậc
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
              <span className="field-label">Tên cấp bậc</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Ví dụ: Senior"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Thứ tự</span>
              <input
                type="number"
                value={draft.rank}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, rank: event.target.value }))
                }
                placeholder="1"
              />
            </label>
          </div>
          <div className="crud-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={15} aria-hidden="true" />
              ) : (
                <Check size={15} aria-hidden="true" />
              )}
              {editing ? "Lưu thay đổi" : "Thêm cấp bậc"}
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

      {loading && !levels.length ? (
        <Loading label="Đang tải cấp bậc…" />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="num">Thứ tự</th>
                <th>Cấp bậc</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => (
                <tr key={level.name}>
                  <td className="num c-name" data-label="Thứ tự">
                    {level.rank}
                  </td>
                  <td data-label="Cấp bậc">{level.name}</td>
                  <td className="c-go">
                    <RowActions
                      editLabel={`Sửa ${level.name}`}
                      deleteLabel={`Xoá ${level.name}`}
                      onEdit={() => openEdit(level)}
                      onDelete={() => {
                        setConfirming(level);
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
          message={`Xoá cấp bậc ${confirming.name}? Vị trí và hồ sơ đang mang cấp bậc này vẫn giữ nguyên giá trị.`}
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      <p className="crud-note">
        Danh sách sắp theo thứ tự tăng dần. Đổi tên cấp bậc sẽ cập nhật luôn vị
        trí và hồ sơ ứng viên đang dùng tên cũ.
      </p>
    </section>
  );
}
