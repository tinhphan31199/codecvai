"use client";

import { useState } from "react";
import {
  saveWorkspaceSettings,
  useWorkspaceQuery,
  type Workspace,
} from "@/lib/api";
import { useNumberFormat, useT, type MessageKey } from "@/lib/i18n";
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
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

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
        </>
      ) : null}

      <p className="crud-note">{t("settings.security.footnote")}</p>
    </section>
  );
}
