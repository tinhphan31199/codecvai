"use client";

import { useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import {
  createTeamMember,
  deleteTeamMember,
  updateTeamMember,
  useTeam,
  type TeamMember,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import {
  Avatar,
  CardHead,
  LoadError,
  Loading,
} from "../../ui";
import {
  ConfirmDelete,
  FormStatus,
  Pagination,
  RowActions,
  hueOf,
  initialsOf,
  paginate,
} from "./shared";

type Draft = { name: string; email: string; role: string };

const EMPTY: Draft = { name: "", email: "", role: "Recruiter" };
const ROLES = ["Owner", "Recruiter", "Reviewer", "Viewer"];

export default function TeamTab() {
  const { data, loading, error, refetch } = useTeam();
  const t = useT();
  const members = data ?? [];
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const view = paginate(members, page);

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY);
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const openEdit = (member: TeamMember) => {
    setEditing(member);
    setDraft({ name: member.name, email: member.email, role: member.role });
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    const member: TeamMember = {
      name,
      email: draft.email.trim(),
      role: draft.role,
      initials: initialsOf(name),
      hue: hueOf(name),
    };
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      if (editing) {
        await updateTeamMember(editing.name, member);
        setNote(t("settings.team.updated", { name: member.name }));
      } else {
        await createTeamMember(member);
        setNote(t("settings.team.created", { name: member.name }));
      }
      setFormOpen(false);
      setEditing(null);
      setDraft(EMPTY);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("settings.team.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (name: string) => {
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      await deleteTeamMember(name);
      if (editing?.name === name) {
        setFormOpen(false);
        setEditing(null);
      }
      setConfirming(null);
      setNote(t("settings.team.deleted", { name }));
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("settings.team.deleteError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead
        title={t("settings.team.title")}
        meta={t("settings.team.meta", { count: members.length })}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCreate}>
            <Plus size={14} aria-hidden="true" />
            {t("settings.team.add")}
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
              <span className="field-label">{t("settings.team.name")}</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder={t("settings.team.namePlaceholder")}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">{t("settings.team.email")}</span>
              <input
                type="email"
                value={draft.email}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder={t("settings.team.emailPlaceholder")}
              />
            </label>
            <label className="field">
              <span className="field-label">{t("settings.team.role")}</span>
              <select
                value={draft.role}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, role: event.target.value }))
                }
              >
                {ROLES.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="crud-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={15} aria-hidden="true" />
              ) : (
                <Check size={15} aria-hidden="true" />
              )}
              {editing ? t("settings.saveChanges") : t("settings.team.add")}
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

      {loading && !members.length ? (
        <Loading label={t("settings.team.loading")} />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("settings.team.colMember")}</th>
                <th>{t("settings.team.colEmail")}</th>
                <th>{t("settings.team.role")}</th>
                <th aria-label={t("settings.actions")} />
              </tr>
            </thead>
            <tbody>
              {view.visible.map((member) => (
                <tr key={member.name}>
                  <td className="c-name">
                    <div className="person-cell">
                      <Avatar
                        initials={member.initials || initialsOf(member.name)}
                        hue={member.hue}
                        size={30}
                        name={member.name}
                      />
                      <span className="person-main">
                        <span className="row-name">{member.name}</span>
                        <span className="person-sub">
                          {member.role || t("settings.team.defaultRole")}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td data-label={t("settings.team.colEmail")}>
                    {member.email || "—"}
                  </td>
                  <td data-label={t("settings.team.role")}>
                    {member.role || "—"}
                  </td>
                  <td className="c-go">
                    <RowActions
                      editLabel={t("settings.team.editAria", {
                        name: member.name,
                      })}
                      deleteLabel={t("settings.team.deleteAria", {
                        name: member.name,
                      })}
                      onEdit={() => openEdit(member)}
                      onDelete={() => {
                        setConfirming(member.name);
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
          message={t("settings.team.confirm", { name: confirming })}
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      <p className="crud-note">{t("settings.team.footnote")}</p>
    </section>
  );
}
