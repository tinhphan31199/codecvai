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
import { useT } from "@/lib/i18n";
import { CardHead, LoadError, Loading } from "../../ui";
import { ConfirmDelete, FormStatus, Pagination, RowActions, paginate } from "./shared";

type Draft = { id: string; label: string; detail: string };

const EMPTY: Draft = { id: "", label: "", detail: "" };

export default function StagesTab() {
  const t = useT();
  const { data, loading, error, refetch } = useStages();
  const stages = data ?? [];
  const [editing, setEditing] = useState<UploadStage | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirming, setConfirming] = useState<UploadStage | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const nextId = stages.reduce((max, stage) => Math.max(max, stage.id), 0) + 1;
  const view = paginate(stages, page);

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
      setFormError(t("settingsCrud.stages.invalidId"));
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
        setNote(t("settingsCrud.stages.updated", { name: stage.label }));
      } else {
        await createStage(stage);
        setNote(t("settingsCrud.stages.added", { name: stage.label }));
      }
      setFormOpen(false);
      setEditing(null);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("settingsCrud.stages.saveError"),
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
      setNote(t("settingsCrud.stages.deleted", { name: stage.label }));
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : t("settingsCrud.stages.deleteError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead
        title={t("settingsCrud.stages.title")}
        meta={t("settingsCrud.stages.meta", { count: stages.length })}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCreate}>
            <Plus size={14} aria-hidden="true" />
            {t("settingsCrud.stages.add")}
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
              <span className="field-label">
                {t("settingsCrud.stages.field.id")}
              </span>
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
              <span className="field-label">
                {t("settingsCrud.stages.field.label")}
              </span>
              <input
                type="text"
                value={draft.label}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder={t("settingsCrud.stages.field.labelPlaceholder")}
                required
              />
            </label>
            <label className="field is-span-full">
              <span className="field-label">
                {t("settingsCrud.field.description")}
              </span>
              <input
                type="text"
                value={draft.detail}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, detail: event.target.value }))
                }
                placeholder={t(
                  "settingsCrud.stages.field.detailPlaceholder",
                )}
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
              {editing
                ? t("settingsCrud.saveChanges")
                : t("settingsCrud.stages.add")}
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
              {t("action.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {loading && !stages.length ? (
        <Loading label={t("settingsCrud.stages.loading")} />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="num">{t("settingsCrud.stages.col.id")}</th>
                <th>{t("settingsCrud.stages.col.stage")}</th>
                <th>{t("settingsCrud.field.description")}</th>
                <th aria-label={t("settingsCrud.table.actions")} />
              </tr>
            </thead>
            <tbody>
              {view.visible.map((stage) => (
                <tr key={stage.id}>
                  <td
                    className="num c-name"
                    data-label={t("settingsCrud.stages.col.id")}
                  >
                    {stage.id}
                  </td>
                  <td data-label={t("settingsCrud.stages.col.stage")}>
                    {stage.label}
                  </td>
                  <td data-label={t("settingsCrud.field.description")}>
                    {stage.detail || "—"}
                  </td>
                  <td className="c-go">
                    <RowActions
                      editLabel={t("settingsCrud.rowAction.edit", {
                        name: stage.label,
                      })}
                      deleteLabel={t("settingsCrud.rowAction.delete", {
                        name: stage.label,
                      })}
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

      <Pagination
        page={view.page}
        pages={view.pages}
        from={view.from}
        to={view.to}
        total={view.total}
        onChange={setPage}
      />

      {confirming ? (
        <ConfirmDelete
          message={t("settingsCrud.stages.confirmDelete", {
            name: confirming.label,
            id: confirming.id,
          })}
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      <p className="crud-note">{t("settingsCrud.stages.note")}</p>
    </section>
  );
}
