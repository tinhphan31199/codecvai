"use client";

import { useState } from "react";
import { Check, Loader2, Undo2 } from "lucide-react";
import {
  saveWorkspaceSettings,
  useModels,
  useWorkspaceQuery,
  type Workspace,
} from "@/lib/api";
import { CardHead, LoadError, Loading } from "../../ui";
import { FormStatus } from "./shared";

const STAT_KEYS = [
  ["total", "Tổng hồ sơ"],
  ["completed", "Hoàn tất"],
  ["review", "Cần review"],
  ["processing", "Đang xử lý"],
  ["failed", "Thất bại"],
  ["archived", "Lưu trữ"],
  ["positions", "Vị trí đang mở"],
] as const;

type StatKey = (typeof STAT_KEYS)[number][0];

type Draft = Record<StatKey, string> & {
  name: string;
  reviewer: string;
  analysisModel: string;
  updated: string;
};

type DraftSource = Workspace & {
  name?: string;
  reviewer?: string;
  analysisModel?: string;
  updated?: string;
} & Partial<Record<StatKey, number>>;

function toDraft(workspace: DraftSource): Draft {
  const draft: Draft = {
    name: workspace.name ?? "",
    reviewer: workspace.reviewer ?? "",
    analysisModel: workspace.analysisModel ?? "",
    updated: workspace.updated ?? "",
    total: "0",
    completed: "0",
    review: "0",
    processing: "0",
    failed: "0",
    archived: "0",
    positions: "0",
  };
  for (const [key] of STAT_KEYS) {
    const value = workspace[key];
    draft[key] = value === undefined ? "0" : String(value);
  }
  return draft;
}

export default function WorkspaceTab() {
  const { data, loading, error, refetch } = useWorkspaceQuery();
  const { data: modelsData } = useModels();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const current = draft ?? (data ? toDraft(data) : null);
  const modelOptions = Array.from(
    new Set([
      ...(modelsData ?? []).map((model) => model.name),
      ...(current?.analysisModel ? [current.analysisModel] : []),
    ]),
  ).filter(Boolean);

  const patch = (patch: Partial<Draft>) => {
    if (!current) return;
    setDraft({ ...current, ...patch });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!current) return;
    const name = current.name.trim();
    if (!name) {
      setFormError("Thiếu tên workspace.");
      return;
    }
    const values: Record<string, string> = {
      name,
      reviewer: current.reviewer.trim(),
      analysisModel: current.analysisModel.trim(),
      updated: current.updated.trim(),
    };
    for (const [key, label] of STAT_KEYS) {
      const value = Number(current[key]);
      if (!Number.isInteger(value) || value < 0) {
        setFormError(`${label} phải là số nguyên không âm.`);
        return;
      }
      values[key] = String(value);
    }
    setBusy(true);
    setFormError(null);
    setNote(null);
    try {
      const updated = await saveWorkspaceSettings(values);
      setDraft(toDraft(updated));
      setNote("Đã lưu cấu hình workspace.");
      await refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Không lưu được cấu hình.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card crud-card">
      <CardHead title="Cấu hình workspace" meta="workspace_settings · thông tin chung" />

      {formError || note ? (
        <div className="crud-toolbar">
          <FormStatus error={formError} note={note} />
        </div>
      ) : null}

      {loading && !data ? (
        <Loading label="Đang tải cấu hình…" />
      ) : error ? (
        <LoadError message={error} onRetry={refetch} />
      ) : current ? (
        <form className="crud-form" onSubmit={submit}>
          <div className="crud-grid">
            <label className="field is-span-2">
              <span className="field-label">Tên workspace</span>
              <input
                type="text"
                value={current.name}
                onChange={(event) => patch({ name: event.target.value })}
                placeholder="Ví dụ: Product Engineering"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Reviewer mặc định</span>
              <input
                type="text"
                value={current.reviewer}
                onChange={(event) => patch({ reviewer: event.target.value })}
                placeholder="Tên người phụ trách"
              />
            </label>
            <label className="field">
              <span className="field-label">Mô hình phân tích</span>
              <select
                value={current.analysisModel}
                onChange={(event) =>
                  patch({ analysisModel: event.target.value })
                }
              >
                {modelOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field is-span-2">
              <span className="field-label">Cập nhật</span>
              <input
                type="text"
                value={current.updated}
                onChange={(event) => patch({ updated: event.target.value })}
                placeholder="Ví dụ: 26/10/2026 · 14:12"
              />
            </label>
          </div>

          <div className="criteria-editor">
            <div className="criteria-editor-head">
              <span>Chỉ số dashboard</span>
              <span className="crud-note">Số nguyên không âm</span>
            </div>
            <div className="crud-grid">
              {STAT_KEYS.map(([key, label]) => (
                <label className="field" key={key}>
                  <span className="field-label">{label}</span>
                  <input
                    type="number"
                    min={0}
                    value={current[key]}
                    onChange={(event) =>
                      patch({ [key]: event.target.value } as Partial<Draft>)
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="crud-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={15} aria-hidden="true" />
              ) : (
                <Check size={15} aria-hidden="true" />
              )}
              Lưu cấu hình
            </button>
            {draft ? (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setDraft(null);
                  setFormError(null);
                  setNote(null);
                }}
                disabled={busy}
              >
                <Undo2 size={15} aria-hidden="true" />
                Hoàn tác
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <p className="crud-note">
        Tên workspace, số vị trí đang mở và mô hình phân tích hiển thị ở thanh
        điều hướng; các chỉ số dùng cho Dashboard, danh sách và báo cáo. Thay
        đổi áp dụng ngay sau khi lưu.
      </p>
    </section>
  );
}
