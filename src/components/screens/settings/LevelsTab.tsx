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
import { useNumberFormat, useT } from "@/lib/i18n";
import { CardHead, LoadError, Loading } from "../../ui";
import { ConfirmDelete, FormStatus, RowActions } from "./shared";

type Draft = { name: string; rank: string };

const EMPTY: Draft = { name: "", rank: "" };

export default function LevelsTab() {
  const { data, loading, error, refetch } = useLevels();
  const t = useT();
  const fmt = useNumberFormat();
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
      setFormError(t("settings.levels.rankError"));
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
            ? t("settings.levels.renamed", {
                from: editing.name,
                to: level.name,
              })
            : t("settings.levels.updated", { name: level.name }),
        );
      } else {
        await createLevel(level);
        setNote(t("settings.levels.added", { name: level.name }));
      }
      setFormOpen(false);
      setEditing(null);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("settings.levels.saveError"),
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
      setNote(t("settings.levels.deleted", { name: level.name }));
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("settings.levels.deleteError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead
        title={t("settings.levels.title")}
        meta={t("settings.levels.meta", { count: levels.length })}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCreate}>
            <Plus size={14} aria-hidden="true" />
            {t("settings.levels.add")}
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
              <span className="field-label">{t("settings.levels.name")}</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder={t("settings.levels.namePlaceholder")}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">{t("settings.levels.rank")}</span>
              <input
                type="number"
                value={draft.rank}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, rank: event.target.value }))
                }
                placeholder={t("settings.levels.rankPlaceholder")}
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
              {editing ? t("settings.saveChanges") : t("settings.levels.add")}
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

      {loading && !levels.length ? (
        <Loading label={t("settings.levels.loading")} />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("settings.levels.colLevel")}</th>
                <th className="num">{t("settings.levels.rank")}</th>
                <th aria-label={t("settings.actions")} />
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => (
                <tr key={level.name}>
                  <td className="c-name">
                    <span className="person-main">
                      <span className="row-name">{level.name}</span>
                    </span>
                  </td>
                  <td className="num" data-label={t("settings.levels.rank")}>
                    {fmt(level.rank)}
                  </td>
                  <td className="c-go">
                    <RowActions
                      editLabel={t("settings.levels.editAria", {
                        name: level.name,
                      })}
                      deleteLabel={t("settings.levels.deleteAria", {
                        name: level.name,
                      })}
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
          message={t("settings.levels.confirm", { name: confirming.name })}
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      <p className="crud-note">{t("settings.levels.footnote")}</p>
    </section>
  );
}
