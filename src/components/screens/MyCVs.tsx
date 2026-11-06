"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import type { Screen } from "@/data/codecv";
import {
  deleteGeneratedCV,
  updateGeneratedCV,
  useGeneratedCV,
  useGeneratedCVs,
  type GeneratedAccent,
  type GeneratedTemplate,
} from "@/lib/api";
import { localeOf, useLang, useT, type MessageKey } from "@/lib/i18n";
import CVPreview from "../cv/CVPreview";
import { buildCVHTML } from "../cv/templates";
import { CardHead, EmptyState, PageHead } from "../ui";

const templateNameKeys: Record<GeneratedTemplate, MessageKey> = {
  classic: "builder.templateClassicName",
  sidebar: "builder.templateSidebarName",
  compact: "builder.templateCompactName",
};

const accentNameKeys: Record<GeneratedAccent, MessageKey> = {
  sky: "builder.accentSkyName",
  slate: "builder.accentSlateName",
  emerald: "builder.accentEmeraldName",
  amber: "builder.accentAmberName",
};

const TEMPLATES: GeneratedTemplate[] = ["classic", "sidebar", "compact"];
const ACCENTS: GeneratedAccent[] = ["sky", "slate", "emerald", "amber"];

export default function MyCVs({
  go,
}: {
  go: (screen: Screen, id?: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const query = useGeneratedCVs();
  const cvs = query.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = () => {
    void query.refetch();
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(localeOf(lang), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  return (
    <div className="screen">
      <PageHead
        title={t("screen.myCvs")}
        sub={t("savedCvs.sub")}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => go("builder")}
          >
            <Plus size={15} aria-hidden="true" />
            {t("savedCvs.newCv")}
          </button>
        }
      />

      {query.error ? (
        <div className="callout callout-negative" role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <div>
            <p className="callout-title">{t("state.loadError")}</p>
            <p className="callout-body">{query.error}</p>
          </div>
        </div>
      ) : null}

      <section className="card saved-cv-browser">
        <CardHead
          title={t("savedCvs.listTitle")}
          meta={t("savedCvs.listMeta", { count: cvs.length })}
        />

        {query.loading && !cvs.length ? (
          <p className="saved-cv-loading">
            <Loader2 className="spin" size={15} aria-hidden="true" />
            {t("state.loading")}
          </p>
        ) : null}

        {!query.loading && !query.error && cvs.length === 0 ? (
          <EmptyState
            title={t("savedCvs.emptyTitle")}
            detail={t("savedCvs.emptyDetail")}
            action={
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => go("builder")}
              >
                <Plus size={14} aria-hidden="true" />
                {t("savedCvs.newCv")}
              </button>
            }
          />
        ) : null}

        {cvs.length ? (
          <div className="saved-cv-grid">
            {cvs.map((cv) => (
              <button
                type="button"
                className="saved-cv-card"
                key={cv.id}
                onClick={() => setSelectedId(cv.id)}
              >
                <span className="saved-cv-icon" aria-hidden="true">
                  <FileText size={17} />
                </span>
                <span className="saved-cv-main">
                  <span className="saved-cv-name">{cv.name}</span>
                  <span className="saved-cv-role">
                    {cv.targetPosition || t("savedCvs.noRole")}
                  </span>
                  <span className="saved-cv-tags">
                    {cv.level ? (
                      <span className="pill pill-info">{cv.level}</span>
                    ) : null}
                    <span className="pill">
                      {t(templateNameKeys[cv.template])}
                    </span>
                    <span className="pill">
                      {t(accentNameKeys[cv.accent])}
                    </span>
                    <span className="pill">
                      {cv.language === "en"
                        ? t("builder.languageEn")
                        : t("builder.languageVi")}
                    </span>
                  </span>
                </span>
                <span className="saved-cv-date">
                  {t("savedCvs.updated", {
                    date: formatDate(cv.updatedAt),
                  })}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {selectedId ? (
        <SavedCVDetail
          key={selectedId}
          id={selectedId}
          go={go}
          onClose={() => setSelectedId(null)}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}

function SavedCVDetail({
  id,
  go,
  onClose,
  onChanged,
}: {
  id: string;
  go: (screen: Screen, id?: string) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const query = useGeneratedCV(id);
  const cv = query.data;
  const [styleOverride, setStyleOverride] = useState<{
    template: GeneratedTemplate;
    accent: GeneratedAccent;
  } | null>(null);
  const styleTemplate = styleOverride?.template ?? cv?.template ?? "classic";
  const styleAccent = styleOverride?.accent ?? cv?.accent ?? "sky";
  const [busy, setBusy] = useState<"style" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  const html = useMemo(() => {
    if (!cv || !styleTemplate || !styleAccent) return "";
    return buildCVHTML({
      input: cv.input,
      content: cv.content,
      template: styleTemplate,
      accent: styleAccent,
      language: cv.language,
    });
  }, [cv, styleTemplate, styleAccent]);

  const dirty = Boolean(
    cv &&
      styleTemplate &&
      styleAccent &&
      (styleTemplate !== cv.template || styleAccent !== cv.accent),
  );

  const print = () => {
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  const saveStyle = async () => {
    if (!cv || !styleTemplate || !styleAccent || busy) return;
    setBusy("style");
    setError(null);
    setNotice("");
    try {
      await updateGeneratedCV(cv.id, {
        name: cv.name,
        language: cv.language,
        template: styleTemplate,
        accent: styleAccent,
        content: cv.content,
        input: cv.input,
        modelId: cv.modelId,
        provider: cv.provider,
      });
      await query.refetch();
      setNotice(t("savedCvs.styleSaved"));
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("savedCvs.styleError"),
      );
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!cv || busy) return;
    setBusy("delete");
    setError(null);
    try {
      await deleteGeneratedCV(cv.id);
      onChanged();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("savedCvs.deleteError"),
      );
      setBusy(null);
    }
  };

  const openBuilder = () => {
    onClose();
    go("builder", id);
  };

  return (
    <div className="market-detail-modal" role="presentation" onClick={onClose}>
      <div
        className="market-detail-dialog saved-cv-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-cv-name"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="market-detail-head">
          <span className="saved-cv-dialog-icon" aria-hidden="true">
            <FileText size={20} />
          </span>
          <div className="market-detail-id">
            <h2 id="saved-cv-name">{cv?.name ?? t("state.loading")}</h2>
            <p>{cv?.targetPosition || t("savedCvs.noRole")}</p>
            {cv ? (
              <div className="market-detail-tags">
                {cv.level ? (
                  <span className="pill pill-info">{cv.level}</span>
                ) : null}
                <span className="pill">
                  {t(
                    templateNameKeys[
                      styleTemplate ?? cv.template
                    ],
                  )}
                </span>
                <span className="pill">
                  {t(accentNameKeys[styleAccent ?? cv.accent])}
                </span>
                <span className="pill">
                  {cv.language === "en"
                    ? t("builder.languageEn")
                    : t("builder.languageVi")}
                </span>
              </div>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            aria-label={t("action.close")}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </header>

        {error ? (
          <div
            className="callout callout-negative market-detail-error"
            role="alert"
          >
            <span>{error}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label={t("action.close")}
              onClick={() => setError(null)}
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        <div className="market-detail-body">
          {query.loading && !cv ? (
            <p className="saved-cv-loading">
              <Loader2 className="spin" size={15} aria-hidden="true" />
              {t("state.loading")}
            </p>
          ) : null}

          {query.error && !cv ? (
            <EmptyState
              title={t("state.loadError")}
              detail={query.error}
              action={
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={query.refetch}
                >
                  {t("action.retry")}
                </button>
              }
            />
          ) : null}

          {cv ? (
            <>
              <div className="cv-preview-toolbar saved-cv-toolbar">
                <label className="field">
                  <span className="field-label">
                    {t("builder.templateLabel")}
                  </span>
                  <select
                    value={styleTemplate}
                    onChange={(event) => {
                      setNotice("");
                      setStyleOverride({
                        template: event.target.value as GeneratedTemplate,
                        accent: styleAccent,
                      });
                    }}
                  >
                    {TEMPLATES.map((value) => (
                      <option key={value} value={value}>
                        {t(templateNameKeys[value])}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">
                    {t("builder.accentLabel")}
                  </span>
                  <select
                    value={styleAccent}
                    onChange={(event) => {
                      setNotice("");
                      setStyleOverride({
                        template: styleTemplate,
                        accent: event.target.value as GeneratedAccent,
                      });
                    }}
                  >
                    {ACCENTS.map((value) => (
                      <option key={value} value={value}>
                        {t(accentNameKeys[value])}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-primary cv-print-btn"
                  disabled={!dirty || busy !== null}
                  onClick={() => void saveStyle()}
                >
                  {busy === "style" ? (
                    <Loader2 className="spin" size={15} aria-hidden="true" />
                  ) : (
                    <Check size={15} aria-hidden="true" />
                  )}
                  {t("savedCvs.saveStyle")}
                </button>
              </div>
              {notice ? (
                <p className="builder-prefill-note" role="status">
                  {notice}
                </p>
              ) : null}
              <CVPreview
                html={html}
                title={t("builder.previewFrameTitle")}
                frameRef={frameRef}
              />
            </>
          ) : null}
        </div>

        {cv ? (
          <footer className="market-detail-foot">
            {confirming ? (
              <div
                className="market-detail-confirm"
                role="alertdialog"
                aria-label={t("savedCvs.deleteConfirmTitle")}
              >
                <div className="market-detail-confirm-text">
                  <strong>{t("savedCvs.deleteConfirmTitle")}</strong>
                  <span>{t("savedCvs.deleteConfirmDetail")}</span>
                </div>
                <div className="market-detail-confirm-actions">
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    disabled={busy !== null}
                    onClick={() => setConfirming(false)}
                  >
                    {t("action.cancel")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={busy !== null}
                    onClick={() => void remove()}
                  >
                    {busy === "delete" ? (
                      <Loader2 className="spin" size={13} aria-hidden="true" />
                    ) : (
                      <Trash2 size={13} aria-hidden="true" />
                    )}
                    {t("savedCvs.delete")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="market-detail-foot-left">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy !== null}
                    onClick={print}
                  >
                    <Printer size={14} aria-hidden="true" />
                    {t("builder.print")}
                  </button>
                </div>
                <div className="market-detail-foot-right">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy !== null}
                    onClick={openBuilder}
                  >
                    <Pencil size={14} aria-hidden="true" />
                    {t("savedCvs.openBuilder")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm market-danger"
                    disabled={busy !== null}
                    onClick={() => setConfirming(true)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t("savedCvs.delete")}
                  </button>
                </div>
              </>
            )}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
