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
import {
  Avatar,
  CardHead,
  LoadError,
  Loading,
} from "../../ui";
import {
  ConfirmDelete,
  FormStatus,
  RowActions,
  hueOf,
  initialsOf,
} from "./shared";

type Draft = { name: string; email: string; role: string };

const EMPTY: Draft = { name: "", email: "", role: "Recruiter" };
const ROLES = ["Owner", "Recruiter", "Reviewer", "Viewer"];

export default function TeamTab() {
  const { data, loading, error, refetch } = useTeam();
  const members = data ?? [];
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
        setNote(`Đã cập nhật ${member.name}.`);
      } else {
        await createTeamMember(member);
        setNote(`Đã thêm ${member.name}.`);
      }
      setFormOpen(false);
      setEditing(null);
      setDraft(EMPTY);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Không lưu được thành viên.",
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
      setNote(`Đã xoá ${name}.`);
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không xoá được.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead
        title="Thành viên"
        meta={`${members.length} người · team_members`}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCreate}>
            <Plus size={14} aria-hidden="true" />
            Thêm thành viên
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
              <span className="field-label">Họ tên</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Nguyễn Văn A"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Email</span>
              <input
                type="email"
                value={draft.email}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="ten@congty.vn"
              />
            </label>
            <label className="field">
              <span className="field-label">Vai trò</span>
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
              {editing ? "Lưu thay đổi" : "Thêm thành viên"}
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

      {loading && !members.length ? (
        <Loading label="Đang tải thành viên…" />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Thành viên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
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
                          {member.role || "Thành viên"}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td data-label="Email">{member.email || "—"}</td>
                  <td data-label="Vai trò">{member.role || "—"}</td>
                  <td className="c-go">
                    <RowActions
                      editLabel={`Sửa ${member.name}`}
                      deleteLabel={`Xoá ${member.name}`}
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

      {confirming ? (
        <ConfirmDelete
          message={`Xoá thành viên ${confirming}? Hồ sơ đã gán người này vẫn giữ tên dạng văn bản.`}
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      <p className="crud-note">
        Ứng viên đang gán reviewer không bị thay đổi khi xoá thành viên; chỉ danh
        mục thành viên bị cập nhật.
      </p>
    </section>
  );
}
