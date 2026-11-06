import type {
  BuilderInput,
  GeneratedAccent,
  GeneratedCVContent,
  GeneratedTemplate,
} from "@/lib/api";

type CVLanguage = "vi" | "en";

interface BuildCVOptions {
  input: BuilderInput;
  content: GeneratedCVContent;
  template: GeneratedTemplate;
  accent: GeneratedAccent;
  language: CVLanguage;
}

const ACCENTS: Record<GeneratedAccent, { main: string; soft: string; ink: string }> = {
  sky: { main: "#0369a1", soft: "#e0f2fe", ink: "#0c4a6e" },
  slate: { main: "#475569", soft: "#f1f5f9", ink: "#1e293b" },
  emerald: { main: "#047857", soft: "#d1fae5", ink: "#064e3b" },
  amber: { main: "#b45309", soft: "#fef3c7", ink: "#78350f" },
};

interface CVLabels {
  summary: string;
  experience: string;
  education: string;
  projects: string;
  skills: string;
  certifications: string;
  languages: string;
  contact: string;
}

const LABELS: Record<CVLanguage, CVLabels> = {
  vi: {
    summary: "Tóm tắt",
    experience: "Kinh nghiệm làm việc",
    education: "Học vấn",
    projects: "Dự án",
    skills: "Kỹ năng",
    certifications: "Chứng chỉ",
    languages: "Ngoại ngữ",
    contact: "Liên hệ",
  },
  en: {
    summary: "Summary",
    experience: "Work experience",
    education: "Education",
    projects: "Projects",
    skills: "Skills",
    certifications: "Certifications",
    languages: "Languages",
    contact: "Contact",
  },
};

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const esc = (value: string | undefined | null) =>
  (value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char]);

const text = (value: string | undefined | null) =>
  esc(value).replace(/\n+/g, "<br>");

const cleanURL = (value: string) =>
  value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

const contacts = (input: BuilderInput) =>
  [
    input.email.trim(),
    input.phone.trim(),
    input.location.trim(),
    cleanURL(input.linkedin),
    cleanURL(input.github),
    cleanURL(input.portfolio),
  ].filter(Boolean);

const headRole = (input: BuilderInput) =>
  [input.position.trim(), input.level.trim()].filter(Boolean).join(" · ");

function bullets(items: string[]): string {
  const list = items.filter((item) => item.trim());
  if (!list.length) return "";
  return `<ul class="cv-bullets">${list
    .map((item) => `<li>${text(item)}</li>`)
    .join("")}</ul>`;
}

function headerBlock(input: BuilderInput): string {
  const lines = contacts(input);
  const role = headRole(input);
  return `<header class="cv-head">
    <div class="cv-head-main">
      <h1>${esc(input.fullName)}</h1>
      ${role ? `<p class="cv-role">${esc(role)}</p>` : ""}
    </div>
    ${
      lines.length
        ? `<ul class="cv-contacts">${lines
            .map((line) => `<li>${esc(line)}</li>`)
            .join("")}</ul>`
        : ""
    }
  </header>`;
}

function summarySection(content: GeneratedCVContent, labels: CVLabels): string {
  if (!content.summary.trim()) return "";
  return `<section class="cv-section">
    <h2>${esc(labels.summary)}</h2>
    <p class="cv-summary">${text(content.summary)}</p>
  </section>`;
}

function experienceSection(
  content: GeneratedCVContent,
  labels: CVLabels,
): string {
  const items = content.experience.filter(
    (item) => item.role || item.company || item.bullets.length,
  );
  if (!items.length) return "";
  return `<section class="cv-section">
    <h2>${esc(labels.experience)}</h2>
    <div class="cv-list">${items
      .map((item) => {
        const title = item.role || item.company;
        const sub = [item.role ? item.company : "", item.location]
          .filter(Boolean)
          .join(" · ");
        return `<article class="cv-item">
          <div class="cv-item-head">
            <div class="cv-item-titles">
              <h3>${esc(title)}</h3>
              ${sub ? `<p class="cv-item-sub">${esc(sub)}</p>` : ""}
            </div>
            ${item.period ? `<span class="cv-period">${esc(item.period)}</span>` : ""}
          </div>
          ${bullets(item.bullets)}
        </article>`;
      })
      .join("")}</div>
  </section>`;
}

function educationSection(
  content: GeneratedCVContent,
  labels: CVLabels,
): string {
  const items = content.education.filter((item) => item.school || item.degree);
  if (!items.length) return "";
  return `<section class="cv-section">
    <h2>${esc(labels.education)}</h2>
    <div class="cv-list">${items
      .map(
        (item) => `<article class="cv-item">
          <div class="cv-item-head">
            <div class="cv-item-titles">
              <h3>${esc(item.school || item.degree)}</h3>
              ${item.school && item.degree ? `<p class="cv-item-sub">${esc(item.degree)}</p>` : ""}
            </div>
            ${item.period ? `<span class="cv-period">${esc(item.period)}</span>` : ""}
          </div>
          ${item.detail ? `<p class="cv-detail">${text(item.detail)}</p>` : ""}
        </article>`,
      )
      .join("")}</div>
  </section>`;
}

function projectSection(
  content: GeneratedCVContent,
  labels: CVLabels,
): string {
  const items = content.projects.filter(
    (item) => item.name || item.role || item.bullets.length,
  );
  if (!items.length) return "";
  return `<section class="cv-section">
    <h2>${esc(labels.projects)}</h2>
    <div class="cv-list">${items
      .map((item) => {
        const sub = [item.role, cleanURL(item.link ?? "")]
          .filter(Boolean)
          .join(" · ");
        return `<article class="cv-item">
          <div class="cv-item-head">
            <div class="cv-item-titles">
              <h3>${esc(item.name || item.role)}</h3>
              ${sub ? `<p class="cv-item-sub">${esc(sub)}</p>` : ""}
            </div>
            ${item.period ? `<span class="cv-period">${esc(item.period)}</span>` : ""}
          </div>
          ${bullets(item.bullets)}
        </article>`;
      })
      .join("")}</div>
  </section>`;
}

function skillsSection(
  content: GeneratedCVContent,
  labels: CVLabels,
): string {
  const groups = content.skills.filter((group) => group.items.length);
  if (!groups.length) return "";
  return `<section class="cv-section">
    <h2>${esc(labels.skills)}</h2>
    <div class="cv-skill-groups">${groups
      .map(
        (group) => `<div class="cv-skill-group">
          ${group.group ? `<h3>${esc(group.group)}</h3>` : ""}
          <div class="cv-chips">${group.items
            .map((item) => `<span class="cv-chip">${esc(item)}</span>`)
            .join("")}</div>
        </div>`,
      )
      .join("")}</div>
  </section>`;
}

function certificationSection(
  content: GeneratedCVContent,
  labels: CVLabels,
): string {
  const items = content.certifications.filter((item) => item.name);
  if (!items.length) return "";
  return `<section class="cv-section">
    <h2>${esc(labels.certifications)}</h2>
    <ul class="cv-plain">${items
      .map((item) => {
        const meta = [item.issuer, item.year].filter(Boolean).join(" · ");
        return `<li>${esc(item.name)}${meta ? ` — ${esc(meta)}` : ""}</li>`;
      })
      .join("")}</ul>
  </section>`;
}

function languageSection(
  content: GeneratedCVContent,
  labels: CVLabels,
): string {
  const items = content.languages.filter((item) => item.name);
  if (!items.length) return "";
  return `<section class="cv-section">
    <h2>${esc(labels.languages)}</h2>
    <ul class="cv-plain">${items
      .map(
        (item) =>
          `<li>${esc(item.name)}${item.level ? ` — ${esc(item.level)}` : ""}</li>`,
      )
      .join("")}</ul>
  </section>`;
}

function mainSections(content: GeneratedCVContent, labels: CVLabels): string {
  return [
    summarySection(content, labels),
    experienceSection(content, labels),
    educationSection(content, labels),
    projectSection(content, labels),
    skillsSection(content, labels),
    certificationSection(content, labels),
    languageSection(content, labels),
  ].join("");
}

function sidebarLayout(
  input: BuilderInput,
  content: GeneratedCVContent,
  labels: CVLabels,
): string {
  const lines = contacts(input);
  const role = headRole(input);
  const side = [
    lines.length
      ? `<section class="cv-section">
          <h2>${esc(labels.contact)}</h2>
          <ul class="cv-side-contacts">${lines
            .map((line) => `<li>${esc(line)}</li>`)
            .join("")}</ul>
        </section>`
      : "",
    skillsSection(content, labels),
    certificationSection(content, labels),
    languageSection(content, labels),
  ].join("");
  const main = [
    summarySection(content, labels),
    experienceSection(content, labels),
    educationSection(content, labels),
    projectSection(content, labels),
  ].join("");

  return `<div class="cv-page">
    <aside class="cv-sidebar">
      <header class="cv-side-head">
        <h1>${esc(input.fullName)}</h1>
        ${role ? `<p class="cv-side-role">${esc(role)}</p>` : ""}
      </header>
      ${side}
    </aside>
    <main class="cv-main">${main}</main>
  </div>`;
}

const BASE_CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body {
  color: #1e293b;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 9.6pt;
  line-height: 1.5;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
h1, h2, h3, p, ul { margin: 0; padding: 0; }
ul { list-style: none; }
.cv-page {
  width: 210mm;
  min-height: 296.8mm;
  background: #fff;
  overflow-wrap: anywhere;
}
.cv-section { margin-top: 5mm; }
.cv-section > h2 {
  margin-bottom: 2mm;
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.cv-summary { font-size: 9.6pt; line-height: 1.55; }
.cv-list { display: flex; flex-direction: column; gap: 2.6mm; }
.cv-item { break-inside: avoid; }
.cv-item-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4mm;
}
.cv-item-titles { min-width: 0; }
.cv-item h3 { font-size: 10.2pt; font-weight: 700; line-height: 1.35; color: #0f172a; }
.cv-item-sub { margin-top: .3mm; font-size: 8.8pt; color: #475569; }
.cv-period {
  flex-shrink: 0;
  font-size: 8.4pt;
  color: #64748b;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.cv-bullets { margin-top: 1.2mm; padding-left: 4.2mm; list-style: disc; }
.cv-bullets li { font-size: 9.2pt; line-height: 1.5; }
.cv-bullets li + li { margin-top: .6mm; }
.cv-detail { margin-top: 1mm; font-size: 9pt; line-height: 1.5; color: #334155; }
.cv-skill-group { break-inside: avoid; }
.cv-skill-group + .cv-skill-group { margin-top: 2mm; }
.cv-skill-group h3 { margin-bottom: .8mm; font-size: 8.8pt; font-weight: 700; color: #334155; }
.cv-chips { display: flex; flex-wrap: wrap; gap: 1.2mm; }
.cv-chip {
  display: inline-block;
  padding: .3mm 2mm;
  border: .5pt solid #cbd5e1;
  border-radius: 999px;
  background: #f8fafc;
  font-size: 8.2pt;
  line-height: 1.45;
  color: #334155;
}
.cv-plain li { font-size: 9pt; line-height: 1.5; }
.cv-plain li + li { margin-top: .8mm; }
.cv-contacts { display: flex; flex-wrap: wrap; }
.cv-contacts li { font-size: 8.6pt; color: #475569; }
.cv-contacts li + li::before { content: "·"; margin: 0 2mm; color: #94a3b8; }
.t-classic .cv-page { padding: 15mm 17mm 16mm; }
.t-classic .cv-head {
  padding-bottom: 4mm;
  border-bottom: 1.4pt solid var(--accent);
  text-align: center;
}
.t-classic .cv-head h1 { font-size: 25pt; line-height: 1.1; letter-spacing: -.01em; color: #0f172a; }
.t-classic .cv-role { margin-top: 1.4mm; font-size: 10.5pt; font-weight: 600; color: var(--accent); }
.t-classic .cv-contacts { margin-top: 2.4mm; justify-content: center; }
.t-classic .cv-section > h2 { padding-bottom: 1mm; border-bottom: .6pt solid #cbd5e1; color: var(--accent-ink); }
.t-compact .cv-page { padding: 11mm 13mm 12mm; font-size: 9pt; }
.t-compact .cv-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 6mm;
  padding-bottom: 2.6mm;
  border-bottom: 1.2pt solid var(--accent);
}
.t-compact .cv-head h1 { font-size: 19pt; line-height: 1.1; color: #0f172a; }
.t-compact .cv-role { margin-top: .8mm; font-size: 9.4pt; font-weight: 600; color: var(--accent); }
.t-compact .cv-contacts { display: grid; grid-template-columns: auto auto; gap: .6mm 4mm; text-align: left; }
.t-compact .cv-contacts li + li::before { content: none; }
.t-compact .cv-section { margin-top: 3.4mm; }
.t-compact .cv-section > h2 {
  margin-bottom: 1.6mm;
  padding-bottom: .8mm;
  border-bottom: .5pt solid #cbd5e1;
  font-size: 8.4pt;
  color: var(--accent-ink);
}
.t-compact .cv-summary { font-size: 8.9pt; line-height: 1.45; }
.t-compact .cv-list { gap: 1.8mm; }
.t-compact .cv-item h3 { font-size: 9.6pt; }
.t-compact .cv-item-sub, .t-compact .cv-period { font-size: 8.2pt; }
.t-compact .cv-bullets { margin-top: .8mm; }
.t-compact .cv-bullets li { font-size: 8.7pt; line-height: 1.42; }
.t-compact .cv-skill-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.6mm 6mm; }
.t-compact .cv-skill-group + .cv-skill-group { margin-top: 0; }
.t-sidebar .cv-page { display: grid; grid-template-columns: 64mm minmax(0, 1fr); padding: 0; }
.t-sidebar .cv-sidebar { padding: 14mm 9mm 14mm 10mm; background: var(--accent-soft); }
.t-sidebar .cv-side-head h1 { font-size: 20pt; line-height: 1.15; color: #0f172a; }
.t-sidebar .cv-side-role { margin-top: 1.4mm; font-size: 9.6pt; font-weight: 600; color: var(--accent-ink); }
.t-sidebar .cv-sidebar .cv-section { margin-top: 7mm; }
.t-sidebar .cv-sidebar .cv-section > h2 {
  margin-bottom: 2mm;
  padding-bottom: 1mm;
  border-bottom: .6pt solid var(--accent);
  font-size: 8.2pt;
  color: var(--accent-ink);
}
.t-sidebar .cv-sidebar .cv-skill-group + .cv-skill-group { margin-top: 2.4mm; }
.t-sidebar .cv-sidebar .cv-skill-group h3 { font-size: 8.2pt; }
.t-sidebar .cv-sidebar .cv-chip {
  border-color: rgba(15, 23, 42, .12);
  background: rgba(255, 255, 255, .72);
  font-size: 7.8pt;
}
.t-sidebar .cv-sidebar .cv-plain li { font-size: 8.4pt; line-height: 1.45; }
.t-sidebar .cv-side-contacts { display: flex; flex-direction: column; gap: 1.4mm; }
.t-sidebar .cv-side-contacts li { font-size: 8.4pt; line-height: 1.45; color: #334155; }
.t-sidebar .cv-main { padding: 14mm 12mm 14mm 11mm; }
.t-sidebar .cv-main .cv-section { margin-top: 5.2mm; }
.t-sidebar .cv-main .cv-section > h2 {
  padding-bottom: 1mm;
  border-bottom: .6pt solid #cbd5e1;
  color: var(--accent-ink);
}
`;

export function buildCVHTML(options: BuildCVOptions): string {
  const { input, content, template, accent, language } = options;
  const labels = LABELS[language];
  const palette = ACCENTS[accent];
  const page =
    template === "sidebar"
      ? sidebarLayout(input, content, labels)
      : `<div class="cv-page">${headerBlock(input)}${mainSections(
          content,
          labels,
        )}</div>`;
  const title = input.fullName.trim()
    ? `${input.fullName.trim()} - CV`
    : "CV";

  // Every dynamic value above is escaped by esc()/text() before reaching srcDoc.
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root { --accent: ${palette.main}; --accent-soft: ${palette.soft}; --accent-ink: ${palette.ink}; }
${BASE_CSS}
</style>
</head>
<body class="t-${template}">
${page}
</body>
</html>`;
}
