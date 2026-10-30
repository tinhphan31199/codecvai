"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { updateUserRole, useUsers, type AppUser } from "@/lib/api";
import { useAuthSession } from "@/lib/auth";
import { useLocaleDate, useT } from "@/lib/i18n";
import { Avatar, CardHead, LoadError, Loading } from "../../ui";
import { FormStatus, Pagination, hueOf, initialsOf, paginate } from "./shared";

export default function UsersTab() {
  const { data, loading, error, refetch } = useUsers();
  const t = useT();
  const fmtDate = useLocaleDate();
  const session = useAuthSession();
  const users = data ?? [];
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const view = paginate(users, page);
  const selfId = session?.user.id ?? "";

  const sourceLabel = (user: AppUser) =>
    user.authSource === "google"
      ? t("settings.users.sourceGoogle")
      : t("settings.users.sourcePassword");

  const roleLabel = (user: AppUser) =>
    user.role === "admin"
      ? t("settings.users.roleAdmin")
      : t("settings.users.roleMember");

  const changeRole = async (user: AppUser) => {
    if (busyId) return;
    const next = user.role === "admin" ? "member" : "admin";
    const name = user.displayName || user.username;
    setBusyId(user.id);
    setFormError(null);
    setNote(null);
    try {
      await updateUserRole(user.id, next);
      setNote(
        t("settings.users.roleUpdated", {
          name,
          role: t(
            next === "admin"
              ? "settings.users.roleAdmin"
              : "settings.users.roleMember",
          ),
        }),
      );
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("settings.users.roleError"),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead
        title={t("settings.users.title")}
        meta={t("settings.users.meta", { count: users.length })}
      />

      {formError || note ? (
        <div className="crud-toolbar">
          <FormStatus error={formError} note={note} />
        </div>
      ) : null}

      {loading && !users.length ? (
        <Loading label={t("settings.users.loading")} />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("settings.users.colUser")}</th>
                <th>{t("settings.users.colEmail")}</th>
                <th>{t("settings.users.colSource")}</th>
                <th>{t("settings.users.colRole")}</th>
                <th className="num">{t("settings.users.colCreated")}</th>
                <th aria-label={t("settings.actions")} />
              </tr>
            </thead>
            <tbody>
              {view.visible.map((user) => {
                const name = user.displayName || user.username;
                const isSelf = user.id === selfId;
                return (
                  <tr key={user.id}>
                    <td className="c-name">
                      <div className="person-cell">
                        <Avatar
                          initials={initialsOf(name)}
                          hue={hueOf(user.username)}
                          size={30}
                          name={name}
                        />
                        <span className="person-main">
                          <span className="queue-title">
                            <span className="row-name">{name}</span>
                            {user.id === selfId ? (
                              <span className="pill pill-neutral">
                                {t("settings.users.you")}
                              </span>
                            ) : null}
                          </span>
                          <span className="person-sub">@{user.username}</span>
                        </span>
                      </div>
                    </td>
                    <td data-label={t("settings.users.colEmail")}>
                      {user.email || "—"}
                    </td>
                    <td data-label={t("settings.users.colSource")}>
                      <span
                        className={`pill ${
                          user.authSource === "google"
                            ? "pill-info"
                            : "pill-neutral"
                        }`}
                      >
                        {sourceLabel(user)}
                      </span>
                    </td>
                    <td data-label={t("settings.users.colRole")}>
                      <span
                        className={`pill ${
                          user.role === "admin"
                            ? "pill-positive"
                            : "pill-neutral"
                        }`}
                      >
                        {roleLabel(user)}
                      </span>
                    </td>
                    <td
                      className="num c-updated"
                      data-label={t("settings.users.colCreated")}
                    >
                      {user.createdAt ? fmtDate(new Date(user.createdAt)) : "—"}
                    </td>
                    <td className="c-go">
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        onClick={() => changeRole(user)}
                        disabled={isSelf || Boolean(busyId)}
                        title={
                          isSelf ? t("settings.users.selfLocked") : undefined
                        }
                        aria-label={
                          isSelf
                            ? t("settings.users.selfLocked")
                            : user.role === "admin"
                              ? t("settings.users.removeAdminAria", { name })
                              : t("settings.users.makeAdminAria", { name })
                        }
                      >
                        {busyId === user.id ? (
                          <Loader2
                            className="spin"
                            size={13}
                            aria-hidden="true"
                          />
                        ) : user.role === "admin" ? (
                          <ShieldOff size={13} aria-hidden="true" />
                        ) : (
                          <ShieldCheck size={13} aria-hidden="true" />
                        )}
                        {user.role === "admin"
                          ? t("settings.users.removeAdmin")
                          : t("settings.users.makeAdmin")}
                      </button>
                    </td>
                  </tr>
                );
              })}
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

      <p className="crud-note">{t("settings.users.footnote")}</p>
    </section>
  );
}
