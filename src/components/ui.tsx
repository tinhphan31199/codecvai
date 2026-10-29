"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  Check,
  ChevronRight,
  CircleAlert,
  Loader2,
  Minus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  evidenceMeta,
  statusMeta,
  type Candidate,
  type CandidateStatus,
  type Criterion,
  type EvidenceState,
} from "@/data/codecv";
import { useT } from "@/lib/i18n";

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className="logo-mark"
    >
      <path
        d="M8.5 4.5h8.2L21.5 9v14.5h-13V4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M16.7 4.5V9h4.8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="m11.6 13.4-2 2.6 2 2.6M16.4 13.4l2 2.6-2 2.6"
        stroke="var(--accent)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m14.9 12.6-1.8 7" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Avatar({
  initials,
  hue,
  size = 32,
  name,
}: {
  initials: string;
  hue: number;
  size?: number;
  name?: string;
}) {
  const style = {
    "--h": hue,
    width: size,
    height: size,
    fontSize: Math.max(11, Math.round(size * 0.34)),
  } as CSSProperties;
  return (
    <span className="avatar" style={style} aria-hidden={name ? undefined : true} title={name}>
      {initials}
    </span>
  );
}

export function StatusPill({ status }: { status: CandidateStatus }) {
  const t = useT();
  const meta = statusMeta[status];
  return <span className={`pill ${meta.className}`}>{t(meta.labelKey)}</span>;
}

export function EvidencePill({ state }: { state: EvidenceState }) {
  const t = useT();
  const meta = evidenceMeta[state];
  return <span className={`pill ${meta.className}`}>{t(meta.shortKey)}</span>;
}

export function EvidenceMeter({
  verified,
  inferred,
  missing,
  total,
  showLegend = false,
}: {
  verified: number;
  inferred: number;
  missing: number;
  total: number;
  showLegend?: boolean;
}) {
  const safeTotal = Math.max(total, 1);
  const t = useT();
  return (
    <div className="evidence">
      <div
        className="evidence-track"
        role="img"
        aria-label={t("evidence.meterAria", {
          verified,
          inferred,
          missing,
          total,
        })}
      >
        {verified > 0 ? (
          <span
            className="ev ev-verified"
            style={{ width: `${(verified / safeTotal) * 100}%` }}
          />
        ) : null}
        {inferred > 0 ? (
          <span
            className="ev ev-inferred"
            style={{ width: `${(inferred / safeTotal) * 100}%` }}
          />
        ) : null}
        {missing > 0 ? (
          <span
            className="ev ev-missing"
            style={{ width: `${(missing / safeTotal) * 100}%` }}
          />
        ) : null}
      </div>
      {showLegend ? (
        <span className="evidence-legend">
          {t("evidence.legend", { verified, inferred, missing })}
        </span>
      ) : null}
    </div>
  );
}

export function StageLadder({
  step,
  failed = false,
  labels = true,
  total = 6,
}: {
  step: number;
  failed?: boolean;
  labels?: boolean;
  total?: number;
}) {
  const t = useT();
  const current = Math.min(step + 1, total);
  return (
    <div className="stage-ladder">
      <div
        className="stage-track"
        role="img"
        aria-label={t("stage.aria", { current, total })}
      >
        {Array.from({ length: total }, (_, i) => {
          const state =
            failed && i === 2
              ? "error"
              : i < step
                ? "done"
                : i === step
                  ? "current"
                  : "pending";
          return <span key={i} className={`stage-seg is-${state}`} />;
        })}
      </div>
      {labels ? (
        <span className="stage-count">
          {t("stage.step", { current, total })}
        </span>
      ) : null}
    </div>
  );
}

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <h1>{title}</h1>
        {sub ? <p className="page-sub">{sub}</p> : null}
      </div>
      {actions ? <div className="head-actions">{actions}</div> : null}
    </header>
  );
}

export function CardHead({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div className="card-head-main">
        <h2>{title}</h2>
        {meta ? <span className="card-meta">{meta}</span> : null}
      </div>
      {action ? <div className="card-action">{action}</div> : null}
    </div>
  );
}

export function EvidenceCount({ candidate }: { candidate: Candidate }) {
  const total = candidate.criteria.length;
  const covered = candidate.criteria.filter((x) => x.state !== "missing").length;
  return (
    <span className="evidence-count num">
      {covered}/{total}
    </span>
  );
}

export function CriterionRow({ item }: { item: Criterion }) {
  return (
    <div className="criterion-row">
      <div className="criterion-main">
        <span className="criterion-label">{item.label}</span>
        <span className="criterion-note">{item.note}</span>
        {item.sources.length ? (
          <span className="source-row">
            {item.sources.map((source) => (
              <span className="source-chip" key={source}>
                {source}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <EvidencePill state={item.state} />
      <span className="criterion-evidence num">{item.evidence}</span>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {detail ? <p className="empty-detail">{detail}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function ListMark({
  state,
}: {
  state: "good" | "warn" | "info";
}) {
  const Icon = state === "good" ? Check : state === "warn" ? CircleAlert : Minus;
  return <Icon size={15} className={`list-mark is-${state}`} aria-hidden="true" />;
}

export function AiBadge() {
  return (
    <span className="ai-badge">
      <Sparkles size={13} aria-hidden="true" />
      CodeCV AI
    </span>
  );
}

export function ArrowLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="card-link" onClick={onClick}>
      {children}
      <ChevronRight size={13} aria-hidden="true" />
    </button>
  );
}

export function Loading({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="load-state" role="status" aria-live="polite">
      <Loader2 className="spin" size={20} aria-hidden="true" />
      <span>{label ?? t("state.loading")}</span>
    </div>
  );
}

export function ScreenLoader({
  title,
  label,
}: {
  title: string;
  label?: string;
}) {
  return (
    <div className="screen">
      <PageHead title={title} />
      <Loading label={label} />
    </div>
  );
}

export function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const t = useT();
  return (
    <div className="load-state is-error" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <div className="load-state-text">
        <span className="load-state-title">{t("state.loadError")}</span>
        <span className="load-state-detail">{message}</span>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          {t("action.retry")}
        </button>
      ) : null}
    </div>
  );
}
