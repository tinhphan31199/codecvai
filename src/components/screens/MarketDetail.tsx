"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  deleteMarketCV,
  downloadMarketCV,
  saveMarketCV,
  setMarketCVVisibility,
  type MarketCV,
} from "@/lib/api";
import { useT, type MessageKey } from "@/lib/i18n";
import { Avatar } from "../ui";

const MARKET_CATEGORIES = [
  "backend",
  "frontend",
  "fullstack",
  "mobile",
  "devops",
  "data",
  "qa",
  "product",
  "design",
  "security",
  "other",
] as const;

type Busy = "save" | "visibility" | "download" | "delete" | null;
type Copied = "email" | "phone" | null;

export default function MarketDetail({
  cv,
  onClose,
  onChanged,
}: {
  cv: MarketCV;
  onClose: () => void;
  onChanged: (cv: MarketCV | null) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<Copied>(null);
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

  const categoryLabel = (slug: string) => {
    const known = (MARKET_CATEGORIES as readonly string[]).includes(slug);
    return t(`market.category.${known ? slug : "other"}` as MessageKey);
  };

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      const result = await saveMarketCV(cv.id, !cv.saved);
      onChanged({ ...cv, saved: result.saved });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("market.saveError"));
    } finally {
      setBusy(null);
    }
  };

  const toggleVisibility = async () => {
    setBusy("visibility");
    setError(null);
    try {
      const next = cv.visibility === "public" ? "private" : "public";
      const updated = await setMarketCVVisibility(cv.id, next);
      onChanged(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("market.visibilityError"),
      );
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy("download");
    setError(null);
    try {
      await downloadMarketCV(cv.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("market.downloadError"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    setError(null);
    try {
      await deleteMarketCV(cv.id);
      onChanged(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("market.deleteError"));
    } finally {
      setBusy(null);
    }
  };

  const copy = async (kind: Copied, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(
        () => setCopied((current) => (current === kind ? null : current)),
        1600,
      );
    } catch {
      setError(t("market.copyError"));
    }
  };

  return (
    <div className="market-detail-modal" role="presentation" onClick={onClose}>
      <div
        className="market-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="market-detail-name"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="market-detail-head">
          <Avatar initials={cv.initials} hue={cv.hue} size={48} name={cv.name} />
          <div className="market-detail-id">
            <h2 id="market-detail-name">{cv.name}</h2>
            <p>{cv.title || t("market.noTitle")}</p>
            <div className="market-detail-tags">
              <span className="market-category">
                {categoryLabel(cv.category)}
              </span>
              {cv.level ? (
                <span className="pill pill-info">{cv.level}</span>
              ) : null}
              {cv.visibility === "private" ? (
                <span className="market-private-tag">
                  <LockKeyhole size={11} aria-hidden="true" />
                  {t("market.private")}
                </span>
              ) : null}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            aria-label={t("market.actionClose")}
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
              aria-label={t("market.actionClose")}
              onClick={() => setError(null)}
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        <div className="market-detail-body">
          <section className="market-detail-section">
            <h3>{t("market.detailProfile")}</h3>
            {cv.summary ? (
              <p className="market-detail-summary">{cv.summary}</p>
            ) : (
              <p className="market-detail-empty">
                {t("market.detailNoSummary")}
              </p>
            )}
            {cv.visibility === "private" ? (
              <p className="market-detail-private-hint">
                <LockKeyhole size={12} aria-hidden="true" />
                {t("market.privateHint")}
              </p>
            ) : null}

            <div className="market-facts">
              <div className="market-fact">
                <span className="market-fact-label">
                  <Mail size={13} aria-hidden="true" />
                  {t("market.detailEmail")}
                </span>
                <span
                  className={`market-fact-value${cv.email ? "" : " is-muted"}`}
                >
                  {cv.email ? (
                    <a href={`mailto:${cv.email}`}>{cv.email}</a>
                  ) : (
                    t("market.detailNoValue")
                  )}
                </span>
                {cv.email ? (
                  <button
                    type="button"
                    className="icon-btn market-copy"
                    aria-label={t("market.actionCopy")}
                    title={t("market.actionCopy")}
                    onClick={() => void copy("email", cv.email)}
                  >
                    {copied === "email" ? (
                      <Check size={13} />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                ) : null}
              </div>

              <div className="market-fact">
                <span className="market-fact-label">
                  <Phone size={13} aria-hidden="true" />
                  {t("market.detailPhone")}
                </span>
                <span
                  className={`market-fact-value${cv.phone ? "" : " is-muted"}`}
                >
                  {cv.phone ? (
                    <a href={`tel:${cv.phone}`}>{cv.phone}</a>
                  ) : (
                    t("market.detailNoValue")
                  )}
                </span>
                {cv.phone ? (
                  <button
                    type="button"
                    className="icon-btn market-copy"
                    aria-label={t("market.actionCopy")}
                    title={t("market.actionCopy")}
                    onClick={() => void copy("phone", cv.phone)}
                  >
                    {copied === "phone" ? (
                      <Check size={13} />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                ) : null}
              </div>

              <div className="market-fact">
                <span className="market-fact-label">
                  <MapPin size={13} aria-hidden="true" />
                  {t("market.detailLocation")}
                </span>
                <span
                  className={`market-fact-value${cv.location ? "" : " is-muted"}`}
                >
                  {cv.location || t("market.detailNoValue")}
                </span>
              </div>

              <div className="market-fact">
                <span className="market-fact-label">
                  <BriefcaseBusiness size={13} aria-hidden="true" />
                  {t("market.detailYears")}
                </span>
                <span
                  className={`market-fact-value${cv.years > 0 ? "" : " is-muted"}`}
                >
                  {cv.years > 0
                    ? t("market.experience", { count: cv.years })
                    : t("market.detailNoValue")}
                </span>
              </div>

              <div className="market-fact">
                <span className="market-fact-label">
                  <UserRound size={13} aria-hidden="true" />
                  {t("market.detailUploadedBy")}
                </span>
                <span className="market-fact-value">
                  {cv.uploadedBy || t("market.anonymous")}
                </span>
              </div>

              <div className="market-fact">
                <span className="market-fact-label">
                  <CalendarDays size={13} aria-hidden="true" />
                  {t("market.detailCreated")}
                </span>
                <span className="market-fact-value">{cv.createdAt}</span>
              </div>

              <div className="market-fact">
                <span className="market-fact-label">
                  <Sparkles size={13} aria-hidden="true" />
                  {t("market.detailModel")}
                </span>
                <span
                  className={`market-fact-value${cv.model ? "" : " is-muted"}`}
                >
                  {cv.model || t("market.detailNoValue")}
                </span>
              </div>

              <div className="market-fact">
                <span className="market-fact-label">
                  <FileText size={13} aria-hidden="true" />
                  {t("market.detailFile")}
                </span>
                <span
                  className={`market-fact-value${cv.fileName ? "" : " is-muted"}`}
                >
                  {cv.fileName || t("market.detailNoValue")}
                </span>
              </div>
            </div>
          </section>

          <section className="market-detail-section">
            <h3>{t("market.detailSkills")}</h3>
            {cv.skills.length ? (
              <div className="market-skills">
                {cv.skills.map((skill) => (
                  <span className="market-skill" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="market-detail-empty">{t("market.detailNoSkills")}</p>
            )}
          </section>

          <section className="market-detail-section">
            <h3>{t("market.detailHighlights")}</h3>
            {cv.highlights.length ? (
              <ul className="market-detail-highlights">
                {cv.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="market-detail-empty">
                {t("market.detailNoHighlights")}
              </p>
            )}
          </section>
        </div>

        <footer className="market-detail-foot">
          {confirming ? (
            <div
              className="market-detail-confirm"
              role="alertdialog"
              aria-label={t("market.deleteConfirmTitle")}
            >
              <div className="market-detail-confirm-text">
                <strong>{t("market.deleteConfirmTitle")}</strong>
                <span>{t("market.deleteConfirmDetail")}</span>
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
                  {t("market.actionDelete")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="market-detail-foot-left">
                <button
                  type="button"
                  className={`btn btn-sm${
                    cv.saved ? " market-saved-btn" : " btn-primary"
                  }`}
                  aria-pressed={cv.saved}
                  disabled={busy !== null}
                  onClick={() => void save()}
                >
                  {busy === "save" ? (
                    <Loader2 className="spin" size={14} aria-hidden="true" />
                  ) : cv.saved ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Bookmark size={14} aria-hidden="true" />
                  )}
                  {cv.saved ? t("market.actionSaved") : t("market.actionSave")}
                </button>
                {cv.hasCv ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy !== null}
                    onClick={() => void download()}
                  >
                    {busy === "download" ? (
                      <Loader2 className="spin" size={14} aria-hidden="true" />
                    ) : (
                      <Download size={14} aria-hidden="true" />
                    )}
                    {t("market.actionDownload")}
                  </button>
                ) : (
                  <span className="market-detail-note">
                    {t("market.detailNoCv")}
                  </span>
                )}
              </div>
              {cv.canEdit ? (
                <div className="market-detail-foot-right">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy !== null}
                    onClick={() => void toggleVisibility()}
                  >
                    {busy === "visibility" ? (
                      <Loader2 className="spin" size={14} aria-hidden="true" />
                    ) : cv.visibility === "public" ? (
                      <EyeOff size={14} aria-hidden="true" />
                    ) : (
                      <Eye size={14} aria-hidden="true" />
                    )}
                    {cv.visibility === "public"
                      ? t("market.actionHide")
                      : t("market.actionShow")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm market-danger"
                    disabled={busy !== null}
                    onClick={() => setConfirming(true)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t("market.actionDelete")}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
