"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import type { CriterionKind, Position } from "@/data/codecv";
import {
  createPosition,
  deletePosition,
  updatePosition,
  useLevels,
  usePositions,
  useTeam,
  useTeams,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { CardHead, LoadError, Loading } from "../../ui";
import { RichTextEditor } from "../../RichTextEditor";
import { ConfirmDelete, FormStatus, Pagination, RowActions, paginate } from "./shared";

type CriterionDraft = {
  label: string;
  kind: CriterionKind;
  weight: number;
  verify: string;
};

type Draft = {
  title: string;
  team: string;
  level: string;
  open: string;
  location: string;
  owner: string;
  description: string;
  candidates: number;
  updated: string;
  criteria: CriterionDraft[];
};

const EMPTY: Draft = {
  title: "",
  team: "",
  level: "Middle",
  open: "1 vị trí",
  location: "TP.HCM · Hybrid",
  owner: "Minh Anh",
  description: "",
  candidates: 0,
  updated: new Date().toLocaleDateString("vi-VN"),
  criteria: [],
};

const FALLBACK_LEVELS = [
  "Intern",
  "Fresher",
  "Junior",
  "Middle",
  "Senior",
  "Lead",
  "Principal",
  "Manager",
  "Director",
];

function toDraft(position: Position): Draft {
  return {
    title: position.title,
    team: position.team,
    level: position.level || "Middle",
    open: position.open,
    location: position.location,
    owner: position.owner,
    description: position.description,
    candidates: position.candidates,
    updated: position.updated || new Date().toLocaleDateString("vi-VN"),
    criteria: position.criteria.map((criterion) => ({ ...criterion })),
  };
}

export default function PositionsTab() {
  const t = useT();
  const { data, loading, error, refetch } = usePositions();
  const { data: levelData } = useLevels();
  const { data: memberData } = useTeam();
  const { data: teamsData } = useTeams();
  const positions = data ?? [];
  const levelOptions = levelData?.length
    ? levelData.map((level) => level.name)
    : FALLBACK_LEVELS;
  const teamOptions = (teamsData ?? []).map((team) => team.name);
  const ownerOptions = (memberData ?? [])
    .map((member) => member.name)
    .filter(Boolean);
  const [editing, setEditing] = useState<Position | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirming, setConfirming] = useState<Position | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");

  const searchTerm = query.trim().toLowerCase();
  const filteredPositions = positions.filter((position) => {
    if (teamFilter !== "all" && position.team !== teamFilter) return false;
    if (!searchTerm) return true;
    return `${position.title} ${position.id} ${position.team} ${position.level} ${position.owner}`
      .toLowerCase()
      .includes(searchTerm);
  });
  const filtersActive = Boolean(searchTerm) || teamFilter !== "all";
  const teamFilterOptions = Array.from(
    new Set([...teamOptions, ...positions.map((position) => position.team)]),
  ).filter(Boolean);

  const view = paginate(filteredPositions, page);

  const levelChoices =
    draft.level && !levelOptions.includes(draft.level)
      ? [draft.level, ...levelOptions]
      : levelOptions;

  const teamChoices =
    draft.team && !teamOptions.includes(draft.team)
      ? [draft.team, ...teamOptions]
      : teamOptions;

  const ownerChoices =
    draft.owner && !ownerOptions.includes(draft.owner)
      ? [draft.owner, ...ownerOptions]
      : ownerOptions;

  const openCreate = () => {
    setEditing(null);
    setDraft({
      ...EMPTY,
      team: teamOptions[0] ?? "",
      level: levelOptions[0],
      owner: ownerOptions[0] ?? EMPTY.owner,
      criteria: [],
    });
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const openEdit = (position: Position) => {
    setEditing(position);
    setDraft({
      ...toDraft(position),
      team: position.team || teamOptions[0] || "",
    });
    setFormOpen(true);
    setFormError(null);
    setNote(null);
    setConfirming(null);
  };

  const patchDraft = (patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const patchCriterion = (index: number, patch: Partial<CriterionDraft>) => {
    setDraft((prev) => ({
      ...prev,
      criteria: prev.criteria.map((criterion, idx) =>
        idx === index ? { ...criterion, ...patch } : criterion,
      ),
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    const position: Position = {
      id: editing?.id ?? `jd-${Date.now()}`,
      title,
      team: draft.team.trim(),
      level: draft.level,
      open: draft.open.trim(),
      candidates: Math.max(0, draft.candidates),
      updated: draft.updated.trim(),
      owner: draft.owner.trim(),
      location: draft.location.trim(),
      description: draft.description.trim(),
      criteria: draft.criteria
        .filter((criterion) => criterion.label.trim())
        .map((criterion) => ({
          label: criterion.label.trim(),
          kind: criterion.kind,
          weight: Number.isFinite(criterion.weight) ? criterion.weight : 0,
          verify: criterion.verify.trim(),
        })),
    };
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      if (editing) {
        await updatePosition(position);
        setNote(t("settingsCrud.positions.updated", { name: position.title }));
      } else {
        await createPosition(position);
        setNote(t("settingsCrud.positions.created", { name: position.title }));
      }
      setFormOpen(false);
      setEditing(null);
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : t("settingsCrud.positions.saveError"),
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (position: Position) => {
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      await deletePosition(position.id);
      if (editing?.id === position.id) {
        setFormOpen(false);
        setEditing(null);
      }
      setConfirming(null);
      setNote(t("settingsCrud.positions.deleted", { name: position.title }));
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : t("settingsCrud.positions.deleteError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead
        title={t("settingsCrud.positions.title")}
        meta={
          filtersActive
            ? t("settingsCrud.positions.metaFiltered", {
                shown: filteredPositions.length,
                total: positions.length,
              })
            : t("settingsCrud.positions.meta", { count: positions.length })
        }
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={openCreate}>
            <Plus size={14} aria-hidden="true" />
            {t("settingsCrud.positions.add")}
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
                {t("settingsCrud.positions.field.title")}
              </span>
              <input
                type="text"
                value={draft.title}
                onChange={(event) => patchDraft({ title: event.target.value })}
                placeholder={t(
                  "settingsCrud.positions.field.titlePlaceholder",
                )}
                required
              />
            </label>
            <label className="field">
              <span className="field-label">
                {t("settingsCrud.positions.field.team")}
              </span>
              {teamChoices.length ? (
                <select
                  value={draft.team}
                  onChange={(event) => patchDraft({ team: event.target.value })}
                >
                  {teamChoices.map((team) => (
                    <option key={team}>{team}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={draft.team}
                  onChange={(event) => patchDraft({ team: event.target.value })}
                />
              )}
            </label>
            <label className="field">
              <span className="field-label">
                {t("settingsCrud.positions.field.level")}
              </span>
              <select
                value={draft.level}
                onChange={(event) => patchDraft({ level: event.target.value })}
              >
                {levelChoices.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">
                {t("settingsCrud.positions.field.location")}
              </span>
              <input
                type="text"
                value={draft.location}
                onChange={(event) => patchDraft({ location: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">
                {t("settingsCrud.positions.field.owner")}
              </span>
              <select
                value={draft.owner}
                onChange={(event) => patchDraft({ owner: event.target.value })}
              >
                {ownerChoices.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">
                {t("settingsCrud.positions.field.open")}
              </span>
              <input
                type="text"
                value={draft.open}
                onChange={(event) => patchDraft({ open: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">
                {t("settingsCrud.positions.field.candidates")}
              </span>
              <input
                type="number"
                min={0}
                value={draft.candidates}
                onChange={(event) =>
                  patchDraft({ candidates: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label className="field">
              <span className="field-label">
                {t("settingsCrud.positions.field.updated")}
              </span>
              <input
                type="text"
                value={draft.updated}
                onChange={(event) => patchDraft({ updated: event.target.value })}
              />
            </label>
            <div className="field is-span-full">
              <span className="field-label">
                {t("settingsCrud.field.description")}
              </span>
              <RichTextEditor
                value={draft.description}
                onChange={(html) => patchDraft({ description: html })}
              />
            </div>
          </div>

          <div className="criteria-editor">
            <div className="criteria-editor-head">
              <span>
                {t("settingsCrud.positions.criteriaHeading")}{" "}
                <span className="num">({draft.criteria.length})</span>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  patchDraft({
                    criteria: [
                      ...draft.criteria,
                      { label: "", kind: "must", weight: 10, verify: "" },
                    ],
                  })
                }
              >
                <Plus size={13} aria-hidden="true" />
                {t("settingsCrud.positions.criteriaAdd")}
              </button>
            </div>
            {draft.criteria.length ? (
              draft.criteria.map((criterion, index) => (
                <div className="criteria-row" key={index}>
                  <label className="field">
                    <span className="field-label">
                      {t("settingsCrud.positions.criteria.label")}
                    </span>
                    <input
                      type="text"
                      value={criterion.label}
                      onChange={(event) =>
                        patchCriterion(index, { label: event.target.value })
                      }
                      placeholder={t(
                        "settingsCrud.positions.criteria.labelPlaceholder",
                      )}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      {t("settingsCrud.positions.criteria.kind")}
                    </span>
                    <select
                      value={criterion.kind}
                      onChange={(event) =>
                        patchCriterion(index, {
                          kind: event.target.value as CriterionKind,
                        })
                      }
                    >
                      <option value="must">
                        {t("settingsCrud.positions.criteria.kindMust")}
                      </option>
                      <option value="nice">
                        {t("settingsCrud.positions.criteria.kindNice")}
                      </option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">
                      {t("settingsCrud.positions.criteria.weight")}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={criterion.weight}
                      onChange={(event) =>
                        patchCriterion(index, {
                          weight: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">
                      {t("settingsCrud.positions.criteria.verify")}
                    </span>
                    <input
                      type="text"
                      value={criterion.verify}
                      onChange={(event) =>
                        patchCriterion(index, { verify: event.target.value })
                      }
                      placeholder={t(
                        "settingsCrud.positions.criteria.verifyPlaceholder",
                      )}
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t(
                      "settingsCrud.positions.criteria.deleteAria",
                      { index: index + 1 },
                    )}
                    title={t("settingsCrud.positions.criteria.delete")}
                    onClick={() =>
                      patchDraft({
                        criteria: draft.criteria.filter(
                          (_item, idx) => idx !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            ) : (
              <p className="crud-note">
                {t("settingsCrud.positions.criteria.empty")}
              </p>
            )}
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
                : t("settingsCrud.positions.create")}
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

      {positions.length ? (
        <div className="filter-bar">
          <div className="filter-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t("settingsCrud.positions.searchPlaceholder")}
              aria-label={t("settingsCrud.positions.searchAria")}
            />
            {query ? (
              <button
                type="button"
                className="filter-clear"
                aria-label={t("settingsCrud.positions.clearSearchAria")}
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
          <label className="filter-select">
            <span className="visually-hidden">
              {t("settingsCrud.positions.filterTeamAria")}
            </span>
            <select
              value={teamFilter}
              onChange={(event) => {
                setTeamFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">
                {t("settingsCrud.positions.allTeams")}
              </option>
              {teamFilterOptions.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {loading && !positions.length ? (
        <Loading label={t("settingsCrud.positions.loading")} />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : filteredPositions.length || !positions.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("settingsCrud.positions.col.position")}</th>
                <th>{t("settingsCrud.positions.col.location")}</th>
                <th className="num">
                  {t("settingsCrud.positions.col.candidates")}
                </th>
                <th className="num">
                  {t("settingsCrud.positions.col.criteria")}
                </th>
                <th aria-label={t("settingsCrud.table.actions")} />
              </tr>
            </thead>
            <tbody>
              {view.visible.map((position) => (
                <tr key={position.id}>
                  <td className="c-name">
                    <span className="person-main">
                      <span className="row-name">{position.title}</span>
                      <span className="person-sub">
                        {position.team || "—"} · {position.level || "—"}
                      </span>
                    </span>
                  </td>
                  <td data-label={t("settingsCrud.positions.col.location")}>
                    {position.location || "—"}
                  </td>
                  <td
                    className="num"
                    data-label={t("settingsCrud.positions.col.candidates")}
                  >
                    {position.candidates}
                  </td>
                  <td
                    className="num"
                    data-label={t("settingsCrud.positions.col.criteria")}
                  >
                    {position.criteria.length}
                  </td>
                  <td className="c-go">
                    <RowActions
                      editLabel={t("settingsCrud.rowAction.edit", {
                        name: position.title,
                      })}
                      deleteLabel={t("settingsCrud.rowAction.delete", {
                        name: position.title,
                      })}
                      onEdit={() => openEdit(position)}
                      onDelete={() => {
                        setConfirming(position);
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
      ) : (
        <p className="crud-note">{t("settingsCrud.positions.noMatch")}</p>
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
          message={t("settingsCrud.positions.confirmDelete", {
            name: confirming.title,
          })}
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}

      <p className="crud-note">{t("settingsCrud.positions.note")}</p>
    </section>
  );
}
