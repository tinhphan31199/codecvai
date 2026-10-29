"use client";

import { useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import {
  createTeam,
  deleteTeam,
  updateTeam,
  useTeams,
  type Team,
} from "@/lib/api";
import { useNumberFormat, useT } from "@/lib/i18n";
import { CardHead, LoadError, Loading } from "../../ui";
import { ConfirmDelete, FormStatus, Pagination, RowActions, paginate } from "./shared";

type Draft = { name: string; rank: string };

const EMPTY: Draft = { name: "", rank: "" };

export default function TeamsTab() {
  const { data, loading, error, refetch } = useTeams();
  const t = useT();
  const fmt = useNumberFormat();
  const teams = data ?? [];
  const [editing, setEditing] = useState<Team | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirming, setConfirming] = useState<Team | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const nextRank = teams.reduce((max, team) => Math.max(max, team.rank), 0) + 1;
  const view = paginate(teams, page);

  const openCreate = () => {
    setEditing(null);
    setDraft({ name: "", rank: String(nextRank) });
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const openEdit = (team: Team) => {
    setEditing(team);
    setDraft({ name: team.name, rank: String(team.rank) });
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
      setFormError(t("settings.teams.rankError"));
      return;
    }
    const team: Team = { name, rank };
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      if (editing) {
        await updateTeam(editing.name, team);
        setNote(
          editing.name !== team.name
            ? t("settings.teams.renamed", {
                from: editing.name,
                to: team.name,
              })
            : t("settings.teams.updated", { name: team.name }),
        );
      } else {
        await createTeam(team);
        setNote(t("settings.teams.added", { name: team.name }));
      }
      setFormOpen(false);
      setEditing(null);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("settings.teams.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (team: Team) => {
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      await deleteTeam(team.name);
      if (editing?.name === team.name) {
        setFormOpen(false);
        setEditing(null);
      }
      setConfirming(null);
      setNote(t("settings.teams.deleted", { name: team.name }));
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("settings.teams.deleteError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead
        title={t("settings.teams.title")}
        meta={t("settings.teams.meta", { count: teams.length })}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCreate}>
            <Plus size={14} aria-hidden="true" />
            {t("settings.teams.add")}
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
              <span className="field-label">{t("settings.teams.name")}</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder={t("settings.teams.namePlaceholder")}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">{t("settings.teams.rank")}</span>
              <input
                type="number"
                value={draft.rank}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, rank: event.target.value }))
                }
                placeholder={t("settings.teams.rankPlaceholder")}
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
              {editing ? t("settings.saveChanges") : t("settings.teams.add")}
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

      {loading && !teams.length ? (
        <Loading label={t("settings.teams.loading")} />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("settings.teams.colTeam")}</th>
                <th className="num">{t("settings.teams.rank")}</th>
                <th aria-label={t("settings.actions")} />
              </tr>
            </thead>
            <tbody>
              {view.visible.map((team) => (
                <tr key={team.name}>
                  <td className="c-name">
                    <span className="person-main">
                      <span className="row-name">{team.name}</span>
                    </span>
                  </td>
                  <td className="num" data-label={t("settings.teams.rank")}>
                    {fmt(team.rank)}
                  </td>
                  <td className="c-go">
                    <RowActions
                      editLabel={t("settings.teams.editAria", {
                        name: team.name,
                      })}
                      deleteLabel={t("settings.teams.deleteAria", {
                        name: team.name,
                      })}
                      onEdit={() => openEdit(team)}
                      onDelete={() => {
                        setConfirming(team);
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
          message={t("settings.teams.confirm", { name: confirming.name })}
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      <p className="crud-note">{t("settings.teams.footnote")}</p>
    </section>
  );
}
