"use client";

import { useState } from "react";
import { Check, Loader2, Plus, RefreshCw, X } from "lucide-react";
import {
  createModel,
  deleteModel,
  listGeminiModels,
  updateModel,
  useModels,
  useServiceConfigs,
  type AIModel,
  type GeminiModel,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { CardHead, LoadError, Loading } from "../../ui";
import { ConfirmDelete, FormStatus, Pagination, RowActions, Toggle, paginate } from "./shared";

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

const FALLBACK_PROVIDERS = ["Google", "OpenAI", "Anthropic", "Self-hosted"];

export default function ModelsTab() {
  const t = useT();
  const { data, loading, error, refetch } = useModels();
  const { data: providerData } = useServiceConfigs();
  const models = data ?? [];
  const [editing, setEditing] = useState<AIModel | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirming, setConfirming] = useState<AIModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [googleModels, setGoogleModels] = useState<GeminiModel[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const view = paginate(models, page);

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setGoogleModels([]);
    setListError(null);
  };

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY);
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
    setGoogleModels([]);
    setListError(null);
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
    setGoogleModels([]);
    setListError(null);
  };

  const loadGoogleModels = async () => {
    setListBusy(true);
    setListError(null);
    try {
      const list = await listGeminiModels({
        modelId: editing?.id,
      });
      setGoogleModels(list);
      if (!list.length) {
        setListError(t("settingsCrud.models.noModels"));
      }
    } catch (err) {
      setGoogleModels([]);
      setListError(
        err instanceof Error
          ? err.message
          : t("settingsCrud.models.loadModelsError"),
      );
    } finally {
      setListBusy(false);
    }
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
        setNote(t("settingsCrud.models.updated", { name: model.name }));
      } else {
        await createModel(model);
        setNote(t("settingsCrud.models.added", { name: model.name }));
      }
      closeForm();
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : t("settingsCrud.models.saveError"),
      );
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
        err instanceof Error ? err.message : t("settingsCrud.models.toggleError"),
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
      setNote(t("settingsCrud.models.deleted", { name: model.name }));
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : t("settingsCrud.models.deleteError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const isGoogle = draft.provider === "Google";
  const providersFromDb = (providerData ?? [])
    .filter((config) => config.kind === "ai" && config.name.trim())
    .map((config) => config.name);
  const providers = providersFromDb.length ? providersFromDb : FALLBACK_PROVIDERS;
  const providerOptions =
    providers.includes(draft.provider) || !draft.provider
      ? providers
      : [...providers, draft.provider];

  return (
    <section className="card crud-card">
      <CardHead
        title={t("settingsCrud.models.title")}
        meta={t("settingsCrud.models.meta", {
          active: models.filter((model) => model.active).length,
          total: models.length,
        })}
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCreate}>
            <Plus size={14} aria-hidden="true" />
            {t("settingsCrud.models.add")}
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
              <span className="field-label">
                {t("settingsCrud.models.field.provider")}
              </span>
              <select
                value={draft.provider}
                onChange={(event) => {
                  const provider = event.target.value;
                  setDraft((prev) => ({ ...prev, provider }));
                  setGoogleModels([]);
                  setListError(null);
                }}
              >
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>
            <label className="field is-span-2">
              <span className="field-label">
                {t("settingsCrud.models.field.active")}
              </span>
              <Toggle
                checked={draft.active}
                label={t("settingsCrud.models.toggle")}
                onChange={() =>
                  setDraft((prev) => ({ ...prev, active: !prev.active }))
                }
              />
            </label>
            <div className="field is-span-full">
              <span className="field-label">
                {t("settingsCrud.models.field.id")}
              </span>
              {googleModels.length ? (
                <div className="field-row">
                  <select
                    aria-label={t("settingsCrud.models.field.id")}
                    value={draft.id}
                    onChange={(event) => {
                      const id = event.target.value;
                      const picked = googleModels.find((item) => item.id === id);
                      setDraft((prev) => ({
                        ...prev,
                        id,
                        name: picked ? picked.displayName : prev.name,
                      }));
                    }}
                    required
                  >
                    {googleModels.some((item) => item.id === draft.id) ? null : (
                      <option value={draft.id}>
                        {draft.id || t("settingsCrud.models.pickModel")}
                      </option>
                    )}
                    {googleModels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.displayName} · {item.id}
                      </option>
                    ))}
                  </select>
                  {isGoogle ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={loadGoogleModels}
                      disabled={listBusy || busy}
                    >
                      {listBusy ? (
                        <Loader2 className="spin" size={14} aria-hidden="true" />
                      ) : (
                        <RefreshCw size={14} aria-hidden="true" />
                      )}
                      {t("settingsCrud.models.loadModels")}
                    </button>
                  ) : null}
                </div>
              ) : isGoogle ? (
                <div className="field-row">
                  <input
                    type="text"
                    aria-label={t("settingsCrud.models.field.id")}
                    value={draft.id}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, id: event.target.value }))
                    }
                    placeholder="gemini-3.5-flash-lite"
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={loadGoogleModels}
                    disabled={listBusy || busy}
                  >
                    {listBusy ? (
                      <Loader2 className="spin" size={14} aria-hidden="true" />
                    ) : (
                      <RefreshCw size={14} aria-hidden="true" />
                    )}
                    {t("settingsCrud.models.loadModels")}
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  aria-label={t("settingsCrud.models.field.id")}
                  value={draft.id}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, id: event.target.value }))
                  }
                  placeholder="gemini-3.5-flash-lite"
                  required
                />
              )}
              {listError ? (
                <span className="field-hint is-error" role="alert">
                  {listError}
                </span>
              ) : null}
            </div>
            <label className="field is-span-full">
              <span className="field-label">
                {t("settingsCrud.models.field.name")}
              </span>
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
            <label className="field is-span-full">
              <span className="field-label">
                {t("settingsCrud.models.field.note")}
              </span>
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
              {editing
                ? t("settingsCrud.saveChanges")
                : t("settingsCrud.models.add")}
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

      {loading && !models.length ? (
        <Loading label={t("settingsCrud.models.loading")} />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("settingsCrud.models.col.model")}</th>
                <th>{t("settingsCrud.models.col.provider")}</th>
                <th>{t("settingsCrud.models.col.note")}</th>
                <th>{t("settingsCrud.models.col.active")}</th>
                <th aria-label={t("settingsCrud.table.actions")} />
              </tr>
            </thead>
            <tbody>
              {view.visible.map((model) => (
                <tr key={model.id}>
                  <td className="c-name">
                    <span className="person-main">
                      <span className="row-name">{model.name}</span>
                      <span className="person-sub mono">{model.id}</span>
                    </span>
                  </td>
                  <td data-label={t("settingsCrud.models.col.provider")}>
                    {model.apiKeySet ? (
                      <span className="person-main">
                        <span>{model.provider || "—"}</span>
                        <span className="person-sub mono">
                          {t("settingsCrud.models.col.ownKey")} {model.apiKeyHint}
                        </span>
                      </span>
                    ) : (
                      model.provider || "—"
                    )}
                  </td>
                  <td data-label={t("settingsCrud.models.col.note")}>
                    {model.note || "—"}
                  </td>
                  <td data-label={t("settingsCrud.models.col.active")}>
                    <Toggle
                      checked={model.active}
                      label={t("settingsCrud.toggle.enable", {
                        name: model.name,
                      })}
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
                      editLabel={t("settingsCrud.rowAction.edit", {
                        name: model.name,
                      })}
                      deleteLabel={t("settingsCrud.rowAction.delete", {
                        name: model.name,
                      })}
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
          message={t("settingsCrud.models.confirmDelete", {
            name: confirming.name,
          })}
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      <p className="crud-note">{t("settingsCrud.models.note")}</p>
    </section>
  );
}
