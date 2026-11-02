"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { FileText, Printer, X } from "lucide-react";
import type { Candidate, Question } from "@/data/codecv";
import { translate, useLang, type MessageKey, type Vars } from "@/lib/i18n";

interface InterviewSheetPreviewProps {
  candidate: Candidate;
  questions: Question[];
  ratings: Record<string, number>;
  asked: Record<string, boolean>;
  notes: Record<string, string>;
  onClose: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const sheetStyles = `
  :root { color-scheme: light; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #e8eef5;
    color: #0f172a;
    font-family: "Inter", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    width: 794px;
    max-width: calc(100% - 32px);
    margin: 20px auto;
    padding: 52px 56px 44px;
    background: #fff;
    box-shadow: 0 12px 32px rgba(15, 23, 42, .14);
  }
  .doc-head {
    display: flex;
    justify-content: space-between;
    gap: 32px;
    padding-bottom: 16px;
    border-bottom: 2px solid #0f172a;
  }
  .doc-kind {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .16em;
    text-transform: uppercase;
    color: #0284c7;
  }
  .doc-name {
    margin: 6px 0 2px;
    font-size: 24px;
    line-height: 1.15;
    font-weight: 650;
    letter-spacing: -.01em;
  }
  .doc-role { font-size: 12px; color: #475569; }
  .doc-head-meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: none;
    text-align: right;
  }
  .doc-head-meta span {
    display: block;
    font-size: 9.5px;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #64748b;
  }
  .doc-head-meta strong {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    font-weight: 600;
  }
  .doc-progress {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 20px;
    margin-top: 14px;
    font-size: 11px;
    color: #475569;
  }
  .doc-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px 24px;
    margin: 18px 0 0;
  }
  .doc-grid div { min-width: 0; }
  .doc-grid dt {
    font-size: 9.5px;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #64748b;
  }
  .doc-grid dd {
    margin: 3px 0 0;
    font-size: 12px;
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .doc-section { margin-top: 26px; }
  .doc-section h2 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
    font-size: 13px;
    font-weight: 650;
    break-after: avoid;
  }
  .doc-h2-meta {
    font-size: 10.5px;
    font-weight: 500;
    color: #64748b;
  }
  .doc-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  .doc-table th {
    padding: 0 0 6px;
    border-bottom: 1px solid #cbd5e1;
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    text-align: left;
    color: #64748b;
  }
  .doc-table th.num, .doc-table td.num { text-align: right; width: 72px; }
  .doc-table td { padding: 7px 0; border-bottom: 1px solid #eef2f6; }
  .doc-table tr { break-inside: avoid; }
  .doc-table td.num {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .doc-table td.num.is-empty { color: #94a3b8; font-weight: 500; }
  .doc-questions, .doc-notes { margin: 0; padding: 0; list-style: none; }
  .doc-questions { display: flex; flex-direction: column; gap: 8px; }
  .doc-questions li {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 9px;
    font-size: 11.5px;
    line-height: 1.5;
    break-inside: avoid;
  }
  .doc-q-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    border-radius: 50%;
    background: #e0f2fe;
    color: #0369a1;
    font-size: 9.5px;
    font-weight: 650;
  }
  .doc-note {
    display: grid;
    grid-template-columns: 68px minmax(0, 1fr);
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dashed #e2e8f0;
    break-inside: avoid;
  }
  .doc-note:last-child { border-bottom: 0; padding-bottom: 0; }
  .doc-note-index {
    padding-top: 2px;
    font-size: 9.5px;
    font-weight: 650;
    letter-spacing: .06em;
    text-transform: uppercase;
    white-space: nowrap;
    color: #0284c7;
  }
  .doc-note p {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .doc-empty { margin: 0; font-size: 11.5px; font-style: italic; color: #94a3b8; }
  .doc-foot {
    margin-top: 26px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 9.5px;
    letter-spacing: .02em;
    color: #94a3b8;
  }
  @media screen and (max-width: 640px) {
    .sheet { padding: 32px 24px 28px; }
    .doc-head { flex-direction: column; gap: 12px; }
    .doc-head-meta { flex-direction: row; gap: 28px; text-align: left; }
    .doc-name { font-size: 21px; }
    .doc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media print {
    @page { size: A4; margin: 14mm 13mm; }
    html, body { background: #fff; }
    .sheet {
      width: auto;
      max-width: none;
      margin: 0;
      padding: 0;
      box-shadow: none;
    }
    .doc-head, .doc-grid, .doc-progress { break-inside: avoid; }
  }
`;

export function InterviewSheetPreview({
  candidate,
  questions,
  ratings,
  asked,
  notes,
  onClose,
}: InterviewSheetPreviewProps) {
  const lang = useLang();
  const frameRef = useRef<HTMLIFrameElement>(null);

  const html = useMemo(() => {
    const t = (key: MessageKey, vars?: Vars) => translate(lang, key, vars);
    const askedItems = questions.filter((item) => asked[item.id]);
    const noteItems = questions
      .map((item, index) => ({
        index: index + 1,
        note: (notes[item.id] ?? "").trim(),
      }))
      .filter((item) => item.note);
    const ratedCount = candidate.criteria.filter(
      (item) => ratings[item.id] !== undefined,
    ).length;
    const metaCells = [
      [t("interview.sheet.position"), candidate.position],
      [t("interview.sheet.level"), candidate.level || "—"],
      [t("interview.sheet.experience"), t("interview.sheet.years", { years: candidate.years })],
      [t("interview.sheet.location"), candidate.location || "—"],
      [t("interview.sheet.email"), candidate.email || "—"],
      [t("interview.sheet.phone"), candidate.phone || "—"],
    ]
      .map(
        ([label, value]) =>
          `<div><dt>${escapeHtml(String(label))}</dt><dd>${escapeHtml(String(value))}</dd></div>`,
      )
      .join("");

    const rubricRows = candidate.criteria
      .map((item) => {
        const value = ratings[item.id];
        const score =
          value !== undefined
            ? `<td class="num">${value}/4</td>`
            : '<td class="num is-empty">—</td>';
        return `<tr><td>${escapeHtml(item.label)}</td>${score}</tr>`;
      })
      .join("");

    const askedList = askedItems.length
      ? `<ol class="doc-questions">${askedItems
          .map(
            (item, index) =>
              `<li><span class="doc-q-num">${index + 1}</span><span>${escapeHtml(item.text)}</span></li>`,
          )
          .join("")}</ol>`
      : `<p class="doc-empty">${escapeHtml(t("interview.sheet.askedEmpty"))}</p>`;

    const notesList = noteItems.length
      ? `<div class="doc-notes">${noteItems
          .map(
            (item) =>
              `<div class="doc-note"><span class="doc-note-index">${escapeHtml(
                t("interview.sheet.noteIndex", { index: item.index }),
              )}</span><p>${escapeHtml(item.note)}</p></div>`,
          )
          .join("")}</div>`
      : `<p class="doc-empty">${escapeHtml(t("interview.sheet.notesEmpty"))}</p>`;

    return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(t("interview.sheet.frameTitle", { name: candidate.name }))}</title>
<style>${sheetStyles}</style>
</head>
<body>
<main class="sheet">
  <header class="doc-head">
    <div>
      <div class="doc-kind">${escapeHtml(t("interview.sheet.docKind"))}</div>
      <h1 class="doc-name">${escapeHtml(candidate.name)}</h1>
      <div class="doc-role">${escapeHtml(candidate.position)}</div>
    </div>
    <div class="doc-head-meta">
      <div><span>${escapeHtml(t("interview.sheet.reviewer"))}</span><strong>${escapeHtml(candidate.reviewer || "—")}</strong></div>
      <div><span>${escapeHtml(t("interview.sheet.updated"))}</span><strong>${escapeHtml(candidate.updatedAt)}</strong></div>
    </div>
  </header>
  <div class="doc-progress">
    <span>${escapeHtml(t("interview.ratedProgress", { rated: ratedCount, total: candidate.criteria.length }))}</span>
    <span>${escapeHtml(t("interview.askedProgress", { asked: askedItems.length, total: questions.length }))}</span>
  </div>
  <dl class="doc-grid">${metaCells}</dl>
  <section class="doc-section">
    <h2>${escapeHtml(t("interview.rubric.title"))}<span class="doc-h2-meta">${escapeHtml(t("interview.rubric.meta", { count: candidate.criteria.length }))}</span></h2>
    <table class="doc-table">
      <thead><tr><th>${escapeHtml(t("interview.sheet.criterionCol"))}</th><th class="num">${escapeHtml(t("interview.sheet.scoreCol"))}</th></tr></thead>
      <tbody>${rubricRows}</tbody>
    </table>
  </section>
  <section class="doc-section">
    <h2>${escapeHtml(t("interview.sheet.askedTitle"))}</h2>
    ${askedList}
  </section>
  <section class="doc-section">
    <h2>${escapeHtml(t("interview.sheet.notesTitle"))}</h2>
    ${notesList}
  </section>
  <footer class="doc-foot">${escapeHtml(t("interview.sheet.footer", { date: candidate.updatedAt }))}</footer>
</main>
</body>
</html>`;
  }, [lang, candidate, questions, ratings, asked, notes]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const print = useCallback(() => {
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }, []);

  return (
    <div className="pdf-modal" role="presentation" onClick={onClose}>
      <div
        className="pdf-dialog sheet-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={translate(lang, "interview.sheet.previewTitle")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pdf-head">
          <span className="pdf-title">
            <FileText size={15} aria-hidden="true" />
            <span>{translate(lang, "interview.sheet.previewTitle")}</span>
          </span>
          <div className="pdf-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              autoFocus
              onClick={print}
            >
              <Printer size={14} aria-hidden="true" />
              {translate(lang, "interview.sheet.export")}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={translate(lang, "interview.sheet.close")}
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="pdf-body">
          <iframe
            ref={frameRef}
            className="pdf-frame"
            title={translate(lang, "interview.sheet.frameTitle", {
              name: candidate.name,
            })}
            srcDoc={html}
            onLoad={(event) => {
              // focus can sit inside the frame after printing: keep Esc working
              event.currentTarget.contentDocument?.addEventListener(
                "keydown",
                (keyEvent) => {
                  if (keyEvent.key === "Escape") onClose();
                },
              );
            }}
          />
        </div>
        <p className="sheet-foot">{translate(lang, "interview.sheet.hint")}</p>
      </div>
    </div>
  );
}