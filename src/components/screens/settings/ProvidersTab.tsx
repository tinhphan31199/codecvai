"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import {
  updateServiceConfig,
  useServiceConfigs,
  type ServiceConfig,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { CardHead, LoadError, Loading } from "../../ui";
import { FormStatus } from "./shared";

type Draft = {
  baseUrl: string;
  apiKey: string;
};

export default function ProvidersTab() {
  const t = useT();
  const { data, loading, error, refetch } = useServiceConfigs();
  const configs = data ?? [];
  const [editing, setEditing] = useState<ServiceConfig | null>(null);
  const [draft, setDraft] = useState<Draft>({ baseUrl: "", apiKey: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const closeForm = () => {
    setEditing(null);
    setDraft({ baseUrl: "", apiKey: "" });
  };

  const openEdit = (config: ServiceConfig) => {
    setEditing(config);
    setDraft({ baseUrl: config.baseUrl, apiKey: "" });
    setFormError(null);
    setNote(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const apiKey = draft.apiKey.trim();
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      await updateServiceConfig(editing.id, {
        baseUrl: draft.baseUrl.trim(),
        ...(apiKey ? { apiKey } : {}),
      });
      setNote(t("settingsCrud.providers.updated", { name: editing.name }));
      closeForm();
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : t("settingsCrud.providers.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const kindLabel = (config: ServiceConfig) =>
    config.kind === "integration"
      ? t("settingsCrud.providers.kind.integration")
      : t("settingsCrud.providers.kind.ai");

  return (
    <section className="card crud-card">
      <CardHead
        title={t("settingsCrud.providers.title")}
        meta={t("settingsCrud.providers.meta", { count: configs.length })}
      />

      {formError || note ? (
        <div className="crud-toolbar">
          <FormStatus error={formError} note={note} />
        </div>
      ) : null}

      {editing ? (
        <form className="crud-form" onSubmit={submit}>
          <div className="crud-grid">
            <label className="field is-span-full">
              <span className="field-label">
                {t("settingsCrud.providers.field.baseUrl")}
              </span>
              <input
                type="url"
                value={draft.baseUrl}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))
                }
                placeholder="https://…"
              />
            </label>
            <div className="field is-span-full">
              <span className="field-label">
                {t("settingsCrud.providers.field.apiKey")}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                aria-label={t("settingsCrud.providers.field.apiKey")}
                value={draft.apiKey}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, apiKey: event.target.value }))
                }
                placeholder={
                  editing.apiKeySet
                    ? t("settingsCrud.providers.apiKeySaved", {
                        hint: editing.apiKeyHint ?? "••••",
                      })
                    : t("settingsCrud.providers.apiKeyPlaceholder", {
                        name: editing.name,
                      })
                }
              />
              <span className="field-hint">
                {t("settingsCrud.providers.apiKeyHint")}
              </span>
            </div>
          </div>
          <div className="crud-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={15} aria-hidden="true" />
              ) : (
                <Check size={15} aria-hidden="true" />
              )}
              {t("settingsCrud.saveChanges")}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={closeForm}
              disabled={busy}
            >
              <X size={15} aria-hidden="true" />
              {t("action.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {loading && !configs.length ? (
        <Loading label={t("settingsCrud.providers.loading")} />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("settingsCrud.providers.col.provider")}</th>
                <th>{t("settingsCrud.providers.col.baseUrl")}</th>
                <th>{t("settingsCrud.providers.col.key")}</th>
                <th aria-label={t("settingsCrud.table.actions")} />
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr key={config.id}>
                  <td className="c-name">
                    <span className="person-main">
                      <span className="row-name">{config.name}</span>
                      <span className="person-sub">
                        {kindLabel(config)} · <span className="mono">{config.id}</span>
                      </span>
                    </span>
                  </td>
                  <td data-label={t("settingsCrud.providers.col.baseUrl")}>
                    <span className="mono">{config.baseUrl || "—"}</span>
                  </td>
                  <td data-label={t("settingsCrud.providers.col.key")}>
                    {config.apiKeySet ? (
                      <span className="mono">{config.apiKeyHint}</span>
                    ) : (
                      t("settingsCrud.providers.noKey")
                    )}
                  </td>
                  <td className="c-go">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t("settingsCrud.rowAction.edit", {
                          name: config.name,
                        })}
                        title={t("action.edit")}
                        onClick={() => openEdit(config)}
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="crud-note">{t("settingsCrud.providers.note")}</p>
    </section>
  );
}
