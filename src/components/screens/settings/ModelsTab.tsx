"use client";

import { useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import {
  createModel,
  deleteModel,
  updateModel,
  useModels,
  type AIModel,
} from "@/lib/api";
import { CardHead, LoadError, Loading } from "../../ui";
import { ConfirmDelete, FormStatus, RowActions, Toggle } from "./shared";

type Draft = {
  id: string;
  name: string;
  provider: string;
  note: string;
  active: boolean;
};

const EMPTY: Draft = {
  id: "",
  name: "",
  provider: "Google",
  note: "",
  active: true,
};

export default function ModelsTab() {
  const { data, loading, error, refetch } = useModels();
  const models = data ?? [];
  const [editing, setEditing] = useState<AIModel | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirming, setConfirming] = useState<AIModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY);
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const openEdit = (model: AIModel) => {
    setEditing(model);
    setDraft({
      id: model.id,
      name: model.name,
      provider: model.provider,
      note: model.note,
      active: model.active,
    });
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const id = draft.id.trim();
    const name = draft.name.trim();
    if (!id || !name) return;
    const model: AIModel = {
      id,
      name,
      provider: draft.provider.trim(),
      note: draft.note.trim(),
      active: draft.active,
    };
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      if (editing) {
        await updateModel(editing.id, model);
        setNote(`Đã cập nhật ${model.name}.`);
      } else {
        await createModel(model);
        setNote(`Đã thêm ${model.name}.`);
      }
      setFormOpen(false);
      setEditing(null);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không lưu được model.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (model: AIModel) => {
    setBusyId(model.id);
    setFormError(null);
    setNote(null);
    try {
      await updateModel(model.id, { ...model, active: !model.active });
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Không đổi được trạng thái.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (model: AIModel) => {
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      await deleteModel(model.id);
      if (editing?.id === model.id) {
        setFormOpen(false);
        setEditing(null);
      }
      setConfirming(null);
      setNote(`Đã xoá ${model.name}.`);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không xoá được model.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead
        title="AI models"
        meta={`${models.filter((model) => model.active).length}/${models.length} đang bật · ai_models`}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCreate}>
            <Plus size={14} aria-hidden="true" />
            Thêm model
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
              <span className="field-label">Mã model</span>
              <input
                type="text"
                value={draft.id}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, id: event.target.value }))
                }
                placeholder="gemini-3.5-flash-lite"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Tên hiển thị</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Gemini 3.5 Flash Lite"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Nhà cung cấp</span>
              <input
                type="text"
                value={draft.provider}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, provider: event.target.value }))
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Đang bật</span>
              <Toggle
                checked={draft.active}
                label="Bật model"
                onChange={() =>
                  setDraft((prev) => ({ ...prev, active: !prev.active }))
                }
              />
            </label>
            <label className="field is-span-full">
              <span className="field-label">Ghi chú</span>
              <input
                type="text"
                value={draft.note}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, note: event.target.value }))
                }
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
              {editing ? "Lưu thay đổi" : "Thêm model"}
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

      {loading && !models.length ? (
        <Loading label="Đang tải model…" />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Nhà cung cấp</th>
                <th>Ghi chú</th>
                <th>Bật</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.id}>
                  <td className="c-name">
                    <span className="person-main">
                      <span className="row-name">{model.name}</span>
                      <span className="person-sub mono">{model.id}</span>
                    </span>
                  </td>
                  <td data-label="Nhà cung cấp">{model.provider || "—"}</td>
                  <td data-label="Ghi chú">{model.note || "—"}</td>
                  <td data-label="Bật">
                    <Toggle
                      checked={model.active}
                      label={`Bật ${model.name}`}
                      onChange={() => toggle(model)}
                    />
                    {busyId === model.id ? (
                      <Loader2
                        className="spin inline-spin"
                        size={13}
                        aria-hidden="true"
                      />
                    ) : null}
                  </td>
                  <td className="c-go">
                    <RowActions
                      editLabel={`Sửa ${model.name}`}
                      deleteLabel={`Xoá ${model.name}`}
                      onEdit={() => openEdit(model)}
                      onDelete={() => {
                        setConfirming(model);
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
          message={`Xoá model ${confirming.name}? Model mặc định trong workspace vẫn giữ nguyên tên.`}
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      <p className="crud-note">
        Bộ phân tích chỉ nhận Gemini 3.1 Flash Lite và Gemini 3.5 Flash Lite.
        Model thêm vào đây là catalog quản trị, chưa dùng để chạy phân tích.
      </p>
    </section>
  );
}
