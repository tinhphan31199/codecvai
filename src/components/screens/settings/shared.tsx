"use client";

import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useT } from "@/lib/i18n";

export const PAGE_SIZE = 10;

export function paginate<T>(rows: T[], page: number) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pages);
  const start = (safePage - 1) * PAGE_SIZE;
  return {
    page: safePage,
    pages,
    total: rows.length,
    from: rows.length ? start + 1 : 0,
    to: Math.min(start + PAGE_SIZE, rows.length),
    visible: rows.slice(start, start + PAGE_SIZE),
  };
}

export function Pagination({
  page,
  pages,
  from,
  to,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const t = useT();
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="pagination">
      <span className="page-info">
        {t("settings.page.info", { from, to, total })}
      </span>
      <div className="page-controls">
        <button
          type="button"
          className="btn btn-quiet"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={14} aria-hidden="true" />
          {t("settings.page.prev")}
        </button>
        <span className="page-current num">
          {page}/{pages}
        </span>
        <button
          type="button"
          className="btn btn-quiet"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          {t("settings.page.next")}
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? " is-on" : ""}`}
      onClick={onChange}
      disabled={disabled}
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
  const t = useT();
  return (
    <div className="row-actions">
      <button
        type="button"
        className="icon-btn"
        aria-label={editLabel}
        title={t("action.edit")}
        onClick={onEdit}
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label={deleteLabel}
        title={t("action.delete")}
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
  const t = useT();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="confirm-modal"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-head">
          <span className="confirm-icon" aria-hidden="true">
            <AlertTriangle size={15} />
          </span>
          <h3 className="confirm-title" id="confirm-delete-title">
            {t("action.confirmDelete")}
          </h3>
        </div>
        <p className="confirm-message" id="confirm-delete-message">
          {message}
        </p>
        <div className="confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={onCancel}
            disabled={busy}
          >
            {t("action.cancel")}
          </button>
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
            {t("action.delete")}
          </button>
        </div>
      </div>
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
