"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import {
  changePassword,
  fetchAuthConfig,
  linkGoogleAccount,
  saveWorkspaceSettings,
  useWorkspaceQuery,
  type Workspace,
} from "@/lib/api";
import { useAuthSession } from "@/lib/auth";
import { useNumberFormat, useT, type MessageKey } from "@/lib/i18n";
import GoogleSignIn from "../../GoogleSignIn";
import { CardHead, LoadError, Loading } from "../../ui";
import { FormStatus, Toggle } from "./shared";

const SESSION_HOURS = [1, 8, 24];

type NotifyKey = "notifyReview" | "notifyDone" | "notifyDigest";

const NOTIFY_ROWS: {
  key: NotifyKey;
  labelKey: MessageKey;
  subKey: MessageKey;
}[] = [
  {
    key: "notifyReview",
    labelKey: "settings.security.notifyReview",
    subKey: "settings.security.notifyReviewSub",
  },
  {
    key: "notifyDone",
    labelKey: "settings.security.notifyDone",
    subKey: "settings.security.notifyDoneSub",
  },
  {
    key: "notifyDigest",
    labelKey: "settings.security.notifyDigest",
    subKey: "settings.security.notifyDigestSub",
  },
];

type Draft = Record<NotifyKey, boolean> & {
  twoFactor: boolean;
  sessionHours: string;
};

function toDraft(workspace: Workspace): Draft {
  return {
    twoFactor: workspace.twoFactor,
    sessionHours: String(workspace.sessionHours),
    notifyReview: workspace.notifyReview,
    notifyDone: workspace.notifyDone,
    notifyDigest: workspace.notifyDigest,
  };
}

export default function SecurityTab() {
  const { data, loading, error, refetch } = useWorkspaceQuery();
  const t = useT();
  const fmt = useNumberFormat();
  const session = useAuthSession();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwNote, setPwNote] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAuthConfig()
      .then((config) => {
        if (!cancelled) setGoogleClientId(config.googleClientId || null);
      })
      .catch(() => {
        if (!cancelled) setGoogleClientId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = draft ?? (data ? toDraft(data) : null);
  const sessionHours = current ? Number(current.sessionHours) : 0;
  const unsetHours = Boolean(current) && sessionHours <= 0;
  const customHours =
    sessionHours > 0 && !SESSION_HOURS.includes(sessionHours)
      ? sessionHours
      : null;
  const hourOptions = customHours
    ? [...SESSION_HOURS, customHours].sort((a, b) => a - b)
    : SESSION_HOURS;

  const commit = async (next: Draft) => {
    if (!current || busy) return;
    const previous = current;
    setDraft(next);
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      await saveWorkspaceSettings({
        twoFactor: next.twoFactor ? "1" : "0",
        sessionHours: next.sessionHours,
        notifyReview: next.notifyReview ? "1" : "0",
        notifyDone: next.notifyDone ? "1" : "0",
        notifyDigest: next.notifyDigest ? "1" : "0",
      });
      setNote(t("settings.security.saved"));
      await refetch();
    } catch (err) {
      setDraft(previous);
      setFormError(
        err instanceof Error ? err.message : t("settings.security.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const changeOwnPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pwBusy) return;
    if (!currentPassword || !newPassword) {
      setPwNote(null);
      setPwError(t("settings.security.passwordNeeded"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwNote(null);
      setPwError(t("settings.security.passwordMismatch"));
      return;
    }
    if (newPassword.length < 8) {
      setPwNote(null);
      setPwError(t("settings.security.passwordShort"));
      return;
    }
    setPwBusy(true);
    setPwError(null);
    setPwNote(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwNote(t("settings.security.passwordChanged"));
    } catch (err) {
      setPwError(
        err instanceof Error && err.message
          ? err.message
          : t("settings.security.saveError"),
      );
    } finally {
      setPwBusy(false);
    }
  };

  const linkGoogle = async (credential: string) => {
    if (linkBusy) return;
    setLinkBusy(true);
    setLinkError(null);
    setLinkNote(null);
    try {
      await linkGoogleAccount(credential);
      setLinkNote(t("settings.security.googleLinked"));
    } catch (err) {
      setLinkError(
        err instanceof Error && err.message
          ? err.message
          : t("settings.security.googleLinkError"),
      );
    } finally {
      setLinkBusy(false);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead title={t("settings.security.title")} meta="workspace_settings" />

      {formError || note || busy ? (
        <div className="crud-toolbar">
          <FormStatus
            error={formError}
            note={busy ? t("settings.security.saving") : note}
          />
        </div>
      ) : null}

      {loading && !data ? (
        <Loading label={t("settings.security.loading")} />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : current ? (
        <>
          <div className="criteria-editor">
            <div className="criteria-editor-head">
              <span>{t("settings.security.sectionSecurity")}</span>
              <span className="crud-note">
                {t("settings.security.securityNote")}
              </span>
            </div>
            <div className="settings-rows">
              <div className="settings-row">
                <div className="settings-main">
                  <span className="settings-label">
                    {t("settings.security.twoFactor")}
                  </span>
                  <span className="settings-sub">
                    {t("settings.security.twoFactorSub")}
                  </span>
                </div>
                <Toggle
                  checked={current.twoFactor}
                  onChange={() =>
                    commit({ ...current, twoFactor: !current.twoFactor })
                  }
                  label={t("settings.security.twoFactor")}
                  disabled={busy}
                />
              </div>
              <div className="settings-row">
                <div className="settings-main">
                  <span className="settings-label">
                    {t("settings.security.session")}
                  </span>
                  <span className="settings-sub">
                    {t("settings.security.sessionSub")}
                  </span>
                </div>
                <select
                  className="inline-select"
                  value={current.sessionHours}
                  onChange={(event) =>
                    commit({ ...current, sessionHours: event.target.value })
                  }
                  aria-label={t("settings.security.sessionAria")}
                  disabled={busy}
                >
                  {unsetHours ? (
                    <option value="0" disabled>
                      {t("settings.security.sessionUnset")}
                    </option>
                  ) : null}
                  {hourOptions.map((hours) => (
                    <option key={hours} value={hours}>
                      {t("settings.security.hours", {
                        count: hours,
                        hours: fmt(hours),
                      })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="criteria-editor">
            <div className="criteria-editor-head">
              <span>{t("settings.security.sectionNotifications")}</span>
              <span className="crud-note">
                {t("settings.security.notificationsNote")}
              </span>
            </div>
            <div className="settings-rows">
              {NOTIFY_ROWS.map(({ key, labelKey, subKey }) => (
                <div className="settings-row" key={key}>
                  <div className="settings-main">
                    <span className="settings-label">{t(labelKey)}</span>
                    <span className="settings-sub">{t(subKey)}</span>
                  </div>
                  <Toggle
                    checked={current[key]}
                    onChange={() => commit({ ...current, [key]: !current[key] })}
                    label={t(labelKey)}
                    disabled={busy}
                  />
                </div>
              ))}
            </div>
          </div>

          <form className="criteria-editor" onSubmit={changeOwnPassword}>
            <div className="criteria-editor-head">
              <span>{t("settings.security.passwordTitle")}</span>
              <span className="crud-note">
                {t("settings.security.passwordSub")}
              </span>
            </div>
            <div className="crud-grid">
              <label className="field is-span-full">
                <span className="field-label">
                  {t("settings.security.currentPassword")}
                </span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  maxLength={72}
                  disabled={pwBusy}
                />
              </label>
              <label className="field is-span-2">
                <span className="field-label">
                  {t("settings.security.newPassword")}
                </span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  maxLength={72}
                  disabled={pwBusy}
                />
              </label>
              <label className="field is-span-2">
                <span className="field-label">
                  {t("settings.security.confirmPassword")}
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  maxLength={72}
                  disabled={pwBusy}
                />
              </label>
            </div>
            <div className="crud-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={pwBusy}
              >
                {pwBusy ? (
                  <Loader2 className="spin" size={15} aria-hidden="true" />
                ) : (
                  <KeyRound size={15} aria-hidden="true" />
                )}
                {pwBusy
                  ? t("settings.security.changingPassword")
                  : t("settings.security.changePassword")}
              </button>
              {pwError ? (
                <span className="crud-status is-error" role="alert">
                  {pwError}
                </span>
              ) : pwNote ? (
                <span className="crud-status" role="status">
                  {pwNote}
                </span>
              ) : null}
            </div>
          </form>

          <div className="criteria-editor">
            <div className="criteria-editor-head">
              <span>{t("settings.security.googleTitle")}</span>
              <span className="crud-note">
                {t("settings.security.googleSub")}
              </span>
            </div>
            <div className="settings-rows">
              <div className="settings-row">
                <div className="settings-main">
                  <span className="settings-label">
                    {t("settings.security.googleEmail")}
                  </span>
                  <span className="settings-sub">
                    {session?.user.email?.trim()
                      ? session.user.email
                      : t("settings.security.googleUnlinked")}
                  </span>
                </div>
                {googleClientId ? (
                  <GoogleSignIn
                    clientId={googleClientId}
                    width={260}
                    disabled={linkBusy}
                    onCredential={linkGoogle}
                  />
                ) : (
                  <span className="crud-note">
                    {t("settings.security.googleDisabled")}
                  </span>
                )}
              </div>
            </div>
            {linkError || linkNote ? (
              <div className="crud-toolbar">
                <FormStatus error={linkError} note={linkNote} />
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <p className="crud-note">{t("settings.security.footnote")}</p>
    </section>
  );
}
