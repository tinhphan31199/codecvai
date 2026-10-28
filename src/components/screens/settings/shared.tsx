"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? " is-on" : ""}`}
      onClick={onChange}
    >
      <span />
    </button>
  );
}

export function RowActions({
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}: {
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
}) {
  return (
    <div className="row-actions">
      <button
        type="button"
        className="icon-btn"
        aria-label={editLabel}
        title="Sửa"
        onClick={onEdit}
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label={deleteLabel}
        title="Xoá"
        onClick={onDelete}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function ConfirmDelete({
  message,
  busy,
  onConfirm,
  onCancel,
}: {
  message: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="crud-confirm" role="alert">
      <span className="crud-confirm-text">{message}</span>
      <button
        type="button"
        className="btn btn-danger btn-sm"
        onClick={onConfirm}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="spin" size={13} aria-hidden="true" />
        ) : (
          <Trash2 size={13} aria-hidden="true" />
        )}
        Xoá
      </button>
      <button
        type="button"
        className="btn btn-quiet btn-sm"
        onClick={onCancel}
        disabled={busy}
      >
        Hủy
      </button>
    </div>
  );
}

export function FormStatus({
  error,
  note,
}: {
  error: string | null;
  note: string | null;
}) {
  if (error) {
    return (
      <span className="crud-status is-error" role="status">
        {error}
      </span>
    );
  }
  if (note) {
    return (
      <span className="crud-status" role="status">
        {note}
      </span>
    );
  }
  return null;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : first;
  return (first + last).toUpperCase();
}

export function hueOf(name: string) {
  let hash = 0;
  for (const char of name.toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }
  return hash;
}
