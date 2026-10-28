"use client";

import { useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import {
  createStage,
  deleteStage,
  updateStage,
  useStages,
  type UploadStage,
} from "@/lib/api";
import { CardHead, LoadError, Loading } from "../../ui";
import { ConfirmDelete, FormStatus, RowActions } from "./shared";

type Draft = { id: string; label: string; detail: string };

const EMPTY: Draft = { id: "", label: "", detail: "" };

export default function StagesTab() {
  const { data, loading, error, refetch } = useStages();
  const stages = data ?? [];
  const [editing, setEditing] = useState<UploadStage | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirming, setConfirming] = useState<UploadStage | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const nextId = stages.reduce((max, stage) => Math.max(max, stage.id), 0) + 1;

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...EMPTY, id: String(nextId) });
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const openEdit = (stage: UploadStage) => {
    setEditing(stage);
    setDraft({ id: String(stage.id), label: stage.label, detail: stage.detail });
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const id = Number(draft.id);
    const label = draft.label.trim();
    if (!Number.isInteger(id) || id <= 0) {
      setFormError("Mã công đoạn phải là số nguyên dương.");
      return;
    }
    if (!label) return;
    const stage: UploadStage = { id, label, detail: draft.detail.trim() };
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      if (editing) {
        await updateStage(editing.id, stage);
        setNote(`Đã cập nhật công đoạn ${stage.label}.`);
      } else {
        await createStage(stage);
        setNote(`Đã thêm công đoạn ${stage.label}.`);
      }
      setFormOpen(false);
      setEditing(null);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Không lưu được công đoạn.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (stage: UploadStage) => {
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      await deleteStage(stage.id);
      if (editing?.id === stage.id) {
        setFormOpen(false);
        setEditing(null);
      }
      setConfirming(null);
      setNote(`Đã xoá công đoạn ${stage.label}.`);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Không xoá được công đoạn.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead
        title="Công đoạn phân tích"
        meta={`${stages.length} bước · upload_stages`}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCreate}>
            <Plus size={14} aria-hidden="true" />
            Thêm công đoạn
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
            <label className="field">
              <span className="field-label">Mã (số nguyên)</span>
              <input
                type="number"
                min={1}
                value={draft.id}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, id: event.target.value }))
                }
                required
              />
            </label>
            <label className="field is-span-2">
              <span className="field-label">Tên công đoạn</span>
              <input
                type="text"
                value={draft.label}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="Ví dụ: Kiểm tra repository"
                required
              />
            </label>
            <label className="field is-span-full">
              <span className="field-label">Mô tả</span>
              <input
                type="text"
                value={draft.detail}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, detail: event.target.value }))
                }
                placeholder="Hiển thị dưới tên công đoạn"
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
              {editing ? "Lưu thay đổi" : "Thêm công đoạn"}
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

      {loading && !stages.length ? (
        <Loading label="Đang tải công đoạn…" />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="num">Mã</th>
                <th>Công đoạn</th>
                <th>Mô tả</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => (
                <tr key={stage.id}>
                  <td className="num c-name" data-label="Mã">
                    {stage.id}
                  </td>
                  <td data-label="Công đoạn">{stage.label}</td>
                  <td data-label="Mô tả">{stage.detail || "—"}</td>
                  <td className="c-go">
                    <RowActions
                      editLabel={`Sửa ${stage.label}`}
                      deleteLabel={`Xoá ${stage.label}`}
                      onEdit={() => openEdit(stage)}
                      onDelete={() => {
                        setConfirming(stage);
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
          message={`Xoá công đoạn ${confirming.label} (mã ${confirming.id})?`}
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      <p className="crud-note">
        Công đoạn hiển thị theo thứ tự mã tăng dần ở bước chọn tệp của màn Upload
        CV.
      </p>
    </section>
  );
}
