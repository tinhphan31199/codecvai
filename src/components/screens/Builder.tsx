"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  Bookmark,
  CircleAlert,
  ImagePlus,
  Loader2,
  Plus,
  Printer,
  Save,
  ScanSearch,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import type { Screen } from "@/data/codecv";
import {
  analyzeBuilderCV,
  createGeneratedCV,
  generateCV,
  saveBuilderDraft,
  updateGeneratedCV,
  useBuilderDraft,
  useCandidates,
  useGeneratedCV,
  useLevels,
  useModels,
  usePositions,
  type BuilderEducationInput,
  type BuilderExperienceInput,
  type BuilderInput,
  type BuilderProjectInput,
  type GeneratedAccent,
  type GeneratedCVContent,
  type GeneratedCVResult,
  type GeneratedTemplate,
} from "@/lib/api";
import type { CvAnalysisResponse } from "@/lib/cv-analysis";
import { useT, type MessageKey } from "@/lib/i18n";
import CVPreview from "../cv/CVPreview";
import CVReview from "../cv/CVReview";
import SkillPicker from "../cv/SkillPicker";
import { buildCVHTML } from "../cv/templates";
import { CardHead, EmptyState, PageHead } from "../ui";

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

const templateOptions: { value: string; labelKey: MessageKey }[] = [
  { value: "", labelKey: "builder.templateAuto" },
  { value: "classic", labelKey: "builder.templateClassic" },
  { value: "sidebar", labelKey: "builder.templateSidebar" },
  { value: "compact", labelKey: "builder.templateCompact" },
];

const accentOptions: { value: string; labelKey: MessageKey }[] = [
  { value: "", labelKey: "builder.accentAuto" },
  { value: "sky", labelKey: "builder.accentSky" },
  { value: "slate", labelKey: "builder.accentSlate" },
  { value: "emerald", labelKey: "builder.accentEmerald" },
  { value: "amber", labelKey: "builder.accentAmber" },
];

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

type ExperienceDraft = BuilderExperienceInput & { key: number };
type EducationDraft = BuilderEducationInput & { key: number };
type ProjectDraft = BuilderProjectInput & { key: number };

interface BuilderForm {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  position: string;
  level: string;
  years: string;
  linkedin: string;
  github: string;
  portfolio: string;
  notes: string;
  skills: string;
  certifications: string;
  languages: string;
  avatar: string;
  experiences: ExperienceDraft[];
  education: EducationDraft[];
  projects: ProjectDraft[];
  sourceCandidateId: string;
}

let entryKey = 0;

const newExperience = (): ExperienceDraft => ({
  key: ++entryKey,
  company: "",
  role: "",
  period: "",
  description: "",
});

const newEducation = (): EducationDraft => ({
  key: ++entryKey,
  school: "",
  degree: "",
  period: "",
});

const newProject = (): ProjectDraft => ({
  key: ++entryKey,
  name: "",
  role: "",
  period: "",
  description: "",
});

const formFromInput = (input: BuilderInput): BuilderForm => ({
  fullName: input.fullName,
  email: input.email,
  phone: input.phone,
  location: input.location,
  position: input.position,
  level: input.level,
  years: input.years ? String(input.years) : "",
  linkedin: input.linkedin,
  github: input.github,
  portfolio: input.portfolio,
  notes: input.notes,
  skills: input.skills.join(", "),
  certifications: input.certifications.join("\n"),
  languages: input.languages.join("\n"),
  avatar: input.avatar ?? "",
  experiences: input.experiences.map((item) => ({
    key: ++entryKey,
    ...item,
  })),
  education: input.education.map((item) => ({
    key: ++entryKey,
    ...item,
  })),
  projects: input.projects.map((item) => ({
    key: ++entryKey,
    ...item,
  })),
  sourceCandidateId: input.sourceCandidateId ?? "",
});

const initialForm = (): BuilderForm => ({
  fullName: "",
  email: "",
  phone: "",
  location: "",
  position: "",
  level: "Senior",
  years: "",
  linkedin: "",
  github: "",
  portfolio: "",
  notes: "",
  skills: "",
  certifications: "",
  languages: "",
  avatar: "",
  experiences: [newExperience()],
  education: [],
  projects: [],
  sourceCandidateId: "",
});

const AVATAR_SIDE = 320;
const MAX_AVATAR_FILE = 5 * 1024 * 1024;

// Crop the chosen photo to a square and shrink it so the inline data URL stays
// small enough to live in the form snapshot next to the generated CV.
function readAvatarImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("decode"));
      image.onload = () => {
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement("canvas");
        canvas.width = AVATAR_SIDE;
        canvas.height = AVATAR_SIDE;
        const context = canvas.getContext("2d");
        if (!side || !context) {
          reject(new Error("decode"));
          return;
        }
        context.drawImage(
          image,
          (image.naturalWidth - side) / 2,
          (image.naturalHeight - side) / 2,
          side,
          side,
          0,
          0,
          AVATAR_SIDE,
          AVATAR_SIDE,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = typeof reader.result === "string" ? reader.result : "";
    };
    reader.readAsDataURL(file);
  });
}

const splitSkills = (value: string) =>
  value
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const splitLines = (value: string) =>
  value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

const hasContent = (content: GeneratedCVContent) =>
  Boolean(content.summary.trim()) ||
  content.experience.length > 0 ||
  content.education.length > 0 ||
  content.projects.length > 0 ||
  content.skills.length > 0 ||
  content.certifications.length > 0 ||
  content.languages.length > 0;

export default function Builder({
  go,
  savedId,
}: {
  go: (screen: Screen, id?: string) => void;
  savedId?: string;
}) {
  const t = useT();
  const [form, setForm] = useState<BuilderForm>(() => initialForm());
  const [template, setTemplate] = useState("");
  const [accent, setAccent] = useState("");
  const [language, setLanguage] = useState<"vi" | "en">("vi");
  const [modelChoice, setModelChoice] = useState("");
  const [feedback, setFeedback] = useState("");
  const [prefillId, setPrefillId] = useState("");
  const [prefillNotice, setPrefillNotice] = useState("");
  const [draft, setDraft] = useState<GeneratedCVResult | null>(null);
  const [draftTemplate, setDraftTemplate] =
    useState<GeneratedTemplate>("classic");
  const [draftAccent, setDraftAccent] = useState<GeneratedAccent>("sky");
  const [draftLanguage, setDraftLanguage] = useState<"vi" | "en">("vi");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState(savedId ?? "");
  const [cvName, setCvName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const [review, setReview] = useState<CvAnalysisResponse | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState("");
  const loadedSavedRef = useRef<string | null>(null);
  const loadedDraftRef = useRef(false);
  const formTouchedRef = useRef(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const printRef = useRef<HTMLIFrameElement>(null);

  const savedQuery = useGeneratedCV(savedId ?? null);
  const savedLoading = Boolean(savedId && savedQuery.loading);
  const draftQuery = useBuilderDraft(!savedId);

  useEffect(() => {
    const saved = savedQuery.data;
    if (!saved || loadedSavedRef.current === saved.id) return;
    loadedSavedRef.current = saved.id;
    setForm(formFromInput(saved.input));
    setDraft({
      input: saved.input,
      content: saved.content,
      template: saved.template,
      accent: saved.accent,
      modelId: saved.modelId ?? "",
      provider: saved.provider ?? "",
    });
    setDraftTemplate(saved.template);
    setDraftAccent(saved.accent);
    setDraftLanguage(saved.language === "en" ? "en" : "vi");
    setLanguage(saved.language === "en" ? "en" : "vi");
    setReview(null);
    setReviewError(null);
    setCvName(saved.name);
    // One-time hydration when the saved CV being edited finishes loading.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved.modelId) setModelChoice(saved.modelId);
  }, [savedQuery.data]);

  useEffect(() => {
    if (savedId || loadedDraftRef.current || draftQuery.loading) return;
    loadedDraftRef.current = true;
    // Never overwrite anything the user typed while the draft was loading.
    if (formTouchedRef.current) return;
    const savedDraft = draftQuery.data;
    if (!savedDraft) return;
    const nextForm = formFromInput(savedDraft.input);
    if (!nextForm.experiences.length) nextForm.experiences = [newExperience()];
    // The draft arrives after the first render, so the form must adopt it once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(nextForm);
    setTemplate(savedDraft.template);
    setAccent(savedDraft.accent);
    setLanguage(savedDraft.language === "en" ? "en" : "vi");
    setDraftRestored(t("builder.draftRestored"));
  }, [savedId, draftQuery.loading, draftQuery.data, t]);

  const candidatesQuery = useCandidates();
  const candidates = candidatesQuery.data ?? [];
  const levelsQuery = useLevels();
  const levels = levelsQuery.data?.length
    ? levelsQuery.data.map((item) => item.name)
    : FALLBACK_LEVELS;
  const levelOptions =
    form.level && !levels.includes(form.level)
      ? [form.level, ...levels]
      : levels;
  const levelValue = levelOptions.includes(form.level)
    ? form.level
    : (levelOptions[0] ?? "");
  const positionsQuery = usePositions();
  const positionTitles = [
    ...new Set((positionsQuery.data ?? []).map((item) => item.title)),
  ].sort((a, b) => a.localeCompare(b));
  const positionOptions =
    form.position && !positionTitles.includes(form.position)
      ? [form.position, ...positionTitles]
      : positionTitles;
  const modelsQuery = useModels();
  const allModels = modelsQuery.data ?? [];
  const activeModels = allModels.filter((item) => item.active);
  const defaultModel =
    activeModels.find((item) => item.apiKeySet) ?? activeModels[0];
  const modelId = activeModels.some((item) => item.id === modelChoice)
    ? modelChoice
    : (defaultModel?.id ?? "");
  const duplicateModelNames = new Set(
    activeModels
      .filter(
        (item) =>
          activeModels.filter((other) => other.name === item.name).length > 1,
      )
      .map((item) => item.name),
  );
  const modelLabel = (item: (typeof activeModels)[number]) =>
    `${item.name}${duplicateModelNames.has(item.name) ? ` (${item.id})` : ""} · ${item.provider}`;
  const modelName = (id: string) =>
    allModels.find((item) => item.id === id)?.name ?? id;
  const prefillCandidate = candidates.find((item) => item.id === prefillId);

  const previewHTML = useMemo(
    () =>
      draft
        ? buildCVHTML({
            input: draft.input,
            content: draft.content,
            template: draftTemplate,
            accent: draftAccent,
            language: draftLanguage,
          })
        : "",
    [draft, draftTemplate, draftAccent, draftLanguage],
  );

  const printDraft = () => {
    const frame = printRef.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  function update<K extends keyof BuilderForm>(key: K, value: BuilderForm[K]) {
    formTouchedRef.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateExperience(key: number, patch: Partial<BuilderExperienceInput>) {
    formTouchedRef.current = true;
    setForm((prev) => ({
      ...prev,
      experiences: prev.experiences.map((item) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    }));
  }

  function updateEducation(key: number, patch: Partial<BuilderEducationInput>) {
    formTouchedRef.current = true;
    setForm((prev) => ({
      ...prev,
      education: prev.education.map((item) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    }));
  }

  function updateProject(key: number, patch: Partial<BuilderProjectInput>) {
    formTouchedRef.current = true;
    setForm((prev) => ({
      ...prev,
      projects: prev.projects.map((item) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    }));
  }

  const applyPrefill = () => {
    if (!prefillCandidate) return;
    formTouchedRef.current = true;
    setForm((prev) => ({
      ...prev,
      fullName: prefillCandidate.name || prev.fullName,
      email: prefillCandidate.email || prev.email,
      phone: prefillCandidate.phone || prev.phone,
      location: prefillCandidate.location || prev.location,
      position:
        prefillCandidate.position || prefillCandidate.role || prev.position,
      level: prefillCandidate.level || prev.level,
      years: prefillCandidate.years
        ? String(prefillCandidate.years)
        : prev.years,
      skills: prefillCandidate.skills?.length
        ? prefillCandidate.skills.map((item) => item.name).join(", ")
        : prev.skills,
      sourceCandidateId: prefillCandidate.id,
    }));
    setPrefillNotice(
      t("builder.prefillDone", { name: prefillCandidate.name }),
    );
  };

  const toInput = (): BuilderInput => ({
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    location: form.location.trim(),
    linkedin: form.linkedin.trim(),
    github: form.github.trim(),
    portfolio: form.portfolio.trim(),
    position: form.position.trim(),
    level: levelValue,
    years: Number.parseInt(form.years, 10) || 0,
    skills: splitSkills(form.skills),
    experiences: form.experiences.map((item) => ({
      company: item.company.trim(),
      role: item.role.trim(),
      period: item.period.trim(),
      description: item.description.trim(),
    })),
    education: form.education.map((item) => ({
      school: item.school.trim(),
      degree: item.degree.trim(),
      period: item.period.trim(),
    })),
    projects: form.projects.map((item) => ({
      name: item.name.trim(),
      role: item.role.trim(),
      period: item.period.trim(),
      description: item.description.trim(),
    })),
    certifications: splitLines(form.certifications),
    languages: splitLines(form.languages),
    notes: form.notes.trim(),
    avatar: form.avatar || undefined,
    sourceCandidateId: form.sourceCandidateId || undefined,
  });

  const generate = async () => {
    if (busy) return;
    const input = toInput();
    const hasFacts =
      input.skills.length > 0 ||
      input.experiences.some(
        (item) => item.company || item.role || item.description,
      ) ||
      input.education.some((item) => item.school || item.degree) ||
      input.projects.some((item) => item.name || item.role || item.description);
    if (!input.fullName || !input.position || !hasFacts) {
      setError(t("builder.validation"));
      return;
    }
    if (!modelId) {
      setError(t("builder.noModelError"));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await generateCV({
        modelId,
        language,
        template: template || undefined,
        accent: accent || undefined,
        feedback: feedback.trim() || undefined,
        input,
      });
      setDraft(result);
      setDraftTemplate(result.template);
      setDraftAccent(result.accent);
      setDraftLanguage(language);
      setReview(null);
      setReviewError(null);
      setCvName(
        (prev) => prev || `${result.input.fullName} · ${result.input.position}`,
      );
      setSaveError(null);
      setSaveNotice("");
      window.setTimeout(() => {
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        resultRef.current?.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "start",
        });
      }, 80);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!draft || saving) return;
    const isUpdate = Boolean(editingId);
    const payload = {
      name:
        cvName.trim() ||
        `${draft.input.fullName} · ${draft.input.position}`.trim(),
      language: draftLanguage,
      template: draftTemplate,
      accent: draftAccent,
      content: draft.content,
      input: draft.input,
      modelId: draft.modelId || undefined,
      provider: draft.provider || undefined,
    };

    setSaving(true);
    setSaveError(null);
    setSaveNotice("");
    try {
      const saved = isUpdate
        ? await updateGeneratedCV(editingId, payload)
        : await createGeneratedCV(payload);
      setEditingId(saved.id);
      setCvName(saved.name);
      setSaveNotice(
        isUpdate ? t("builder.saveUpdated") : t("builder.saveDone"),
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const analyze = async () => {
    if (!draft || reviewing) return;
    if (!draft.input.position.trim()) {
      setReviewError(t("builder.analyzePositionError"));
      return;
    }
    if (!modelId) {
      setReviewError(t("builder.noModelError"));
      return;
    }

    setReviewing(true);
    setReviewError(null);
    try {
      const result = await analyzeBuilderCV({
        modelId,
        language: draftLanguage,
        input: draft.input,
        content: draft.content,
      });
      setReview(result);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewing(false);
    }
  };

  const saveFormDraft = async () => {
    if (draftSaving) return;
    setDraftSaving(true);
    setDraftStatus("");
    setDraftError(null);
    try {
      await saveBuilderDraft({
        input: toInput(),
        language,
        template,
        accent,
      });
      setDraftStatus(t("builder.draftSaved"));
      setDraftRestored("");
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : String(err));
    } finally {
      setDraftSaving(false);
    }
  };

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_AVATAR_FILE) {
      setAvatarError(t("builder.avatarError"));
      return;
    }
    try {
      const dataURL = await readAvatarImage(file);
      update("avatar", dataURL);
      setAvatarError("");
    } catch {
      setAvatarError(t("builder.avatarError"));
    }
  };

  return (
    <div className="screen">
      <PageHead title={t("screen.builder")} sub={t("builder.sub")} />

      {savedLoading ? (
        <div className="callout" role="status">
          <Loader2 className="spin" size={16} aria-hidden="true" />
          <div>
            <p className="callout-body">{t("builder.loadingSaved")}</p>
          </div>
        </div>
      ) : null}

      {savedQuery.error ? (
        <div className="callout callout-negative" role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <div>
            <p className="callout-title">{t("builder.loadSavedError")}</p>
            <p className="callout-body">{savedQuery.error}</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="callout callout-negative" role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <div>
            <p className="callout-title">{t("builder.errorTitle")}</p>
            <p className="callout-body">{error}</p>
          </div>
        </div>
      ) : null}

      <div className="builder-grid">
        <section className="card builder-card">
          <CardHead
            title={t("builder.profileTitle")}
            meta={t("builder.profileMeta")}
          />

          <div className="builder-avatar">
            <span className="builder-avatar-preview">
              {form.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- inline data URL cannot be optimized
                <img src={form.avatar} alt="" />
              ) : (
                <UserRound size={26} aria-hidden="true" />
              )}
            </span>
            <div className="builder-avatar-body">
              <span className="field-label">{t("builder.avatarLabel")}</span>
              <div className="builder-avatar-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <ImagePlus size={14} aria-hidden="true" />
                  {t("builder.avatarUpload")}
                </button>
                {form.avatar ? (
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    onClick={() => {
                      update("avatar", "");
                      setAvatarError("");
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {t("builder.avatarRemove")}
                  </button>
                ) : null}
              </div>
              <span className="field-hint">{t("builder.avatarHint")}</span>
              {avatarError ? (
                <p className="builder-avatar-error" role="alert">
                  {avatarError}
                </p>
              ) : null}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              className="visually-hidden"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => void onAvatarChange(event)}
            />
          </div>

          <div className="form-stack">
            <div className="builder-prefill">
              <label className="field">
                <span className="field-label">{t("builder.prefillLabel")}</span>
                <select
                  value={prefillId}
                  disabled={candidatesQuery.loading || !candidates.length}
                  onChange={(event) => setPrefillId(event.target.value)}
                >
                  <option value="">
                    {candidates.length
                      ? t("builder.prefillPlaceholder")
                      : t("builder.prefillEmpty")}
                  </option>
                  {candidates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.position}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!prefillCandidate}
                onClick={applyPrefill}
              >
                {t("builder.prefillAction")}
              </button>
            </div>
            {prefillNotice ? (
              <p className="builder-prefill-note" role="status">
                {prefillNotice}
              </p>
            ) : null}
            {draftRestored ? (
              <p className="builder-prefill-note" role="status">
                {draftRestored}
              </p>
            ) : null}

            <div className="form-grid">
              <label className="field">
                <span className="field-label">
                  {t("builder.fullName")} *
                </span>
                <input
                  value={form.fullName}
                  maxLength={120}
                  autoComplete="name"
                  onChange={(event) => update("fullName", event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{t("builder.position")} *</span>
                <select
                  value={form.position}
                  onChange={(event) => update("position", event.target.value)}
                >
                  <option value="">{t("builder.positionPlaceholder")}</option>
                  {positionOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t("builder.email")}</span>
                <input
                  type="email"
                  value={form.email}
                  maxLength={160}
                  autoComplete="email"
                  onChange={(event) => update("email", event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{t("builder.phone")}</span>
                <input
                  type="tel"
                  value={form.phone}
                  maxLength={40}
                  autoComplete="tel"
                  onChange={(event) => update("phone", event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{t("builder.location")}</span>
                <input
                  value={form.location}
                  maxLength={120}
                  onChange={(event) => update("location", event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{t("builder.years")}</span>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={form.years}
                  onChange={(event) => update("years", event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{t("builder.level")}</span>
                <select
                  value={levelValue}
                  onChange={(event) => update("level", event.target.value)}
                >
                  {levelOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">{t("builder.linkedin")}</span>
                <input
                  value={form.linkedin}
                  maxLength={300}
                  placeholder="https://linkedin.com/in/…"
                  onChange={(event) => update("linkedin", event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{t("builder.github")}</span>
                <input
                  value={form.github}
                  maxLength={300}
                  placeholder="https://github.com/…"
                  onChange={(event) => update("github", event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{t("builder.portfolio")}</span>
                <input
                  value={form.portfolio}
                  maxLength={300}
                  placeholder="https://"
                  onChange={(event) => update("portfolio", event.target.value)}
                />
              </label>
            </div>

            <label className="field">
              <span className="field-label">{t("builder.notes")}</span>
              <textarea
                rows={3}
                value={form.notes}
                maxLength={2000}
                placeholder={t("builder.notesPlaceholder")}
                onChange={(event) => update("notes", event.target.value)}
              />
            </label>

            <div className="field">
              <span className="field-label">{t("builder.skills")}</span>
              <SkillPicker
                value={form.skills}
                onChange={(next) => update("skills", next)}
              />
              <textarea
                rows={2}
                value={form.skills}
                placeholder={t("builder.skillsPlaceholder")}
                aria-label={t("builder.skills")}
                onChange={(event) => update("skills", event.target.value)}
              />
              <span className="field-hint">{t("builder.skillsHint")}</span>
            </div>

            <div className="builder-list-grid">
              <label className="field">
                <span className="field-label">
                  {t("builder.certifications")}
                </span>
                <textarea
                  rows={3}
                  value={form.certifications}
                  placeholder={t("builder.listPlaceholder")}
                  onChange={(event) =>
                    update("certifications", event.target.value)
                  }
                />
                <span className="field-hint">
                  {t("builder.certificationsHint")}
                </span>
              </label>
              <label className="field">
                <span className="field-label">{t("builder.languages")}</span>
                <textarea
                  rows={3}
                  value={form.languages}
                  placeholder={t("builder.listPlaceholder")}
                  onChange={(event) =>
                    update("languages", event.target.value)
                  }
                />
                <span className="field-hint">
                  {t("builder.languagesHint")}
                </span>
              </label>
            </div>
          </div>

          <div className="builder-block">
            <div className="builder-block-head">
              <h3>{t("builder.experienceTitle")}</h3>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() =>
                  update("experiences", [...form.experiences, newExperience()])
                }
              >
                <Plus size={14} aria-hidden="true" />
                {t("builder.addExperience")}
              </button>
            </div>
            {form.experiences.length === 0 ? (
              <p className="builder-block-empty">
                {t("builder.experienceEmpty")}
              </p>
            ) : null}
            {form.experiences.map((item, index) => (
              <div className="builder-entry" key={item.key}>
                <div className="builder-entry-head">
                  <span>{t("builder.entryIndex", { index: index + 1 })}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t("builder.removeEntry", { index: index + 1 })}
                    onClick={() =>
                      update(
                        "experiences",
                        form.experiences.filter(
                          (entry) => entry.key !== item.key,
                        ),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="builder-entry-grid is-three">
                  <label className="field">
                    <span className="field-label">{t("builder.company")}</span>
                    <input
                      value={item.company}
                      onChange={(event) =>
                        updateExperience(item.key, {
                          company: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">{t("builder.entryRole")}</span>
                    <input
                      value={item.role}
                      onChange={(event) =>
                        updateExperience(item.key, {
                          role: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">{t("builder.period")}</span>
                    <input
                      value={item.period}
                      placeholder={t("builder.periodPlaceholder")}
                      onChange={(event) =>
                        updateExperience(item.key, {
                          period: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">
                    {t("builder.description")}
                  </span>
                  <textarea
                    rows={3}
                    value={item.description}
                    placeholder={t("builder.descriptionPlaceholder")}
                    onChange={(event) =>
                      updateExperience(item.key, {
                        description: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="builder-block">
            <div className="builder-block-head">
              <h3>{t("builder.educationTitle")}</h3>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() =>
                  update("education", [...form.education, newEducation()])
                }
              >
                <Plus size={14} aria-hidden="true" />
                {t("builder.addEducation")}
              </button>
            </div>
            {form.education.length === 0 ? (
              <p className="builder-block-empty">
                {t("builder.educationEmpty")}
              </p>
            ) : null}
            {form.education.map((item, index) => (
              <div className="builder-entry" key={item.key}>
                <div className="builder-entry-head">
                  <span>{t("builder.entryIndex", { index: index + 1 })}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t("builder.removeEntry", { index: index + 1 })}
                    onClick={() =>
                      update(
                        "education",
                        form.education.filter(
                          (entry) => entry.key !== item.key,
                        ),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="builder-entry-grid is-three">
                  <label className="field">
                    <span className="field-label">{t("builder.school")}</span>
                    <input
                      value={item.school}
                      onChange={(event) =>
                        updateEducation(item.key, {
                          school: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">{t("builder.degree")}</span>
                    <input
                      value={item.degree}
                      onChange={(event) =>
                        updateEducation(item.key, {
                          degree: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">{t("builder.period")}</span>
                    <input
                      value={item.period}
                      placeholder={t("builder.periodPlaceholder")}
                      onChange={(event) =>
                        updateEducation(item.key, {
                          period: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="builder-block">
            <div className="builder-block-head">
              <h3>{t("builder.projectsTitle")}</h3>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() =>
                  update("projects", [...form.projects, newProject()])
                }
              >
                <Plus size={14} aria-hidden="true" />
                {t("builder.addProject")}
              </button>
            </div>
            {form.projects.length === 0 ? (
              <p className="builder-block-empty">{t("builder.projectsEmpty")}</p>
            ) : null}
            {form.projects.map((item, index) => (
              <div className="builder-entry" key={item.key}>
                <div className="builder-entry-head">
                  <span>{t("builder.entryIndex", { index: index + 1 })}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t("builder.removeEntry", { index: index + 1 })}
                    onClick={() =>
                      update(
                        "projects",
                        form.projects.filter((entry) => entry.key !== item.key),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="builder-entry-grid is-three">
                  <label className="field">
                    <span className="field-label">
                      {t("builder.projectName")}
                    </span>
                    <input
                      value={item.name}
                      onChange={(event) =>
                        updateProject(item.key, { name: event.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">{t("builder.entryRole")}</span>
                    <input
                      value={item.role}
                      onChange={(event) =>
                        updateProject(item.key, { role: event.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">{t("builder.period")}</span>
                    <input
                      value={item.period}
                      placeholder={t("builder.periodPlaceholder")}
                      onChange={(event) =>
                        updateProject(item.key, { period: event.target.value })
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">
                    {t("builder.description")}
                  </span>
                  <textarea
                    rows={3}
                    value={item.description}
                    placeholder={t("builder.descriptionPlaceholder")}
                    onChange={(event) =>
                      updateProject(item.key, {
                        description: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </section>

        <aside className="builder-side">
          <section className="card">
            <CardHead
              title={t("builder.styleTitle")}
              meta={t("builder.styleMeta")}
            />
            <div className="form-stack">
              <label className="field">
                <span className="field-label">{t("builder.modelLabel")}</span>
                <select
                  value={modelId}
                  disabled={!activeModels.length}
                  onChange={(event) => setModelChoice(event.target.value)}
                >
                  {activeModels.length === 0 ? (
                    <option value="">{t("builder.noModelOption")}</option>
                  ) : null}
                  {activeModels.map((item) => (
                    <option key={item.id} value={item.id}>
                      {modelLabel(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">
                  {t("builder.cvLanguageLabel")}
                </span>
                <select
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value === "en" ? "en" : "vi")
                  }
                >
                  <option value="vi">{t("builder.languageVi")}</option>
                  <option value="en">{t("builder.languageEn")}</option>
                </select>
              </label>

              <label className="field">
                <span className="field-label">{t("builder.templateLabel")}</span>
                <select
                  value={template}
                  onChange={(event) => setTemplate(event.target.value)}
                >
                  {templateOptions.map((item) => (
                    <option key={item.value || "auto"} value={item.value}>
                      {t(item.labelKey)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">{t("builder.accentLabel")}</span>
                <select
                  value={accent}
                  onChange={(event) => setAccent(event.target.value)}
                >
                  {accentOptions.map((item) => (
                    <option key={item.value || "auto"} value={item.value}>
                      {t(item.labelKey)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">
                  {t("builder.feedbackLabel")}
                </span>
                <textarea
                  rows={3}
                  value={feedback}
                  maxLength={1000}
                  placeholder={t("builder.feedbackPlaceholder")}
                  onChange={(event) => setFeedback(event.target.value)}
                />
                <span className="field-hint">{t("builder.feedbackHint")}</span>
              </label>
            </div>

            <div className="builder-actions">
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={busy || savedLoading || !activeModels.length}
                onClick={() => void generate()}
              >
                {busy ? (
                  <Loader2 className="spin" size={15} aria-hidden="true" />
                ) : (
                  <Sparkles size={15} aria-hidden="true" />
                )}
                {busy ? t("builder.generating") : t("builder.generate")}
              </button>
              {!editingId ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    disabled={draftSaving}
                    onClick={() => void saveFormDraft()}
                  >
                    {draftSaving ? (
                      <Loader2 className="spin" size={15} aria-hidden="true" />
                    ) : (
                      <Bookmark size={15} aria-hidden="true" />
                    )}
                    {draftSaving
                      ? t("builder.draftSaving")
                      : t("builder.draftSave")}
                  </button>
                  {draftError ? (
                    <p className="builder-hint builder-hint-error" role="alert">
                      {t("builder.draftError")}: {draftError}
                    </p>
                  ) : null}
                  {draftStatus ? (
                    <p
                      className="builder-hint builder-draft-done"
                      role="status"
                    >
                      {draftStatus}
                    </p>
                  ) : null}
                </>
              ) : null}
              {activeModels.length === 0 ? (
                <p className="builder-hint builder-hint-error">
                  {t("builder.noModelError")}{" "}
                  <button
                    type="button"
                    className="card-link"
                    onClick={() => go("settings", "models")}
                  >
                    {t("nav.settings")}
                  </button>
                </p>
              ) : (
                <p className="builder-hint">{t("builder.generateHint")}</p>
              )}
              <p className="builder-hint">{t("builder.groundingNote")}</p>
            </div>
          </section>
        </aside>
      </div>

      <section className="card builder-result" ref={resultRef}>
        <CardHead
          title={t("builder.resultTitle")}
          meta={
            draft
              ? t("builder.resultMeta", {
                  template: t(templateNameKeys[draftTemplate]),
                  accent: t(accentNameKeys[draftAccent]),
                  model: draft.modelId ? modelName(draft.modelId) : "—",
                })
              : undefined
          }
        />
        {draft ? (
          hasContent(draft.content) ? (
            <>
              <div className="cv-preview-toolbar">
                <label className="field cv-save-name">
                  <span className="field-label">{t("builder.saveName")}</span>
                  <input
                    value={cvName}
                    maxLength={160}
                    placeholder={t("builder.saveNamePlaceholder")}
                    onChange={(event) => {
                      setCvName(event.target.value);
                      setSaveNotice("");
                    }}
                  />
                </label>
                <label className="field">
                  <span className="field-label">
                    {t("builder.templateLabel")}
                  </span>
                  <select
                    value={draftTemplate}
                    onChange={(event) =>
                      setDraftTemplate(
                        event.target.value as GeneratedTemplate,
                      )
                    }
                  >
                    {(["classic", "sidebar", "compact"] as const).map(
                      (value) => (
                        <option key={value} value={value}>
                          {t(templateNameKeys[value])}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">
                    {t("builder.accentLabel")}
                  </span>
                  <select
                    value={draftAccent}
                    onChange={(event) =>
                      setDraftAccent(event.target.value as GeneratedAccent)
                    }
                  >
                    {(
                      ["sky", "slate", "emerald", "amber"] as const
                    ).map((value) => (
                      <option key={value} value={value}>
                        {t(accentNameKeys[value])}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-ghost cv-print-btn"
                  onClick={printDraft}
                >
                  <Printer size={15} aria-hidden="true" />
                  {t("builder.print")}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost cv-print-btn"
                  disabled={reviewing || saving}
                  title={t("builder.analyzeHint")}
                  onClick={() => void analyze()}
                >
                  {reviewing ? (
                    <Loader2 className="spin" size={15} aria-hidden="true" />
                  ) : (
                    <ScanSearch size={15} aria-hidden="true" />
                  )}
                  {reviewing ? t("builder.analyzing") : t("builder.analyze")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary cv-print-btn"
                  disabled={saving}
                  onClick={() => void saveDraft()}
                >
                  {saving ? (
                    <Loader2 className="spin" size={15} aria-hidden="true" />
                  ) : (
                    <Save size={15} aria-hidden="true" />
                  )}
                  {saving
                    ? t("builder.saving")
                    : editingId
                      ? t("builder.update")
                      : t("builder.save")}
                </button>
              </div>
              {saveError ? (
                <div
                  className="callout callout-negative builder-save-error"
                  role="alert"
                >
                  <CircleAlert size={16} aria-hidden="true" />
                  <div>
                    <p className="callout-title">
                      {t("builder.saveErrorTitle")}
                    </p>
                    <p className="callout-body">{saveError}</p>
                  </div>
                </div>
              ) : null}
              {saveNotice ? (
                <p className="builder-prefill-note" role="status">
                  {saveNotice}
                </p>
              ) : null}
              {reviewing ? (
                <div className="builder-review builder-review-loading" role="status">
                  <Loader2 className="spin" size={16} aria-hidden="true" />
                  <span>{t("builder.analyzing")}</span>
                </div>
              ) : null}
              {reviewError ? (
                <div
                  className="callout callout-negative builder-save-error"
                  role="alert"
                >
                  <CircleAlert size={16} aria-hidden="true" />
                  <div>
                    <p className="callout-title">
                      {t("builder.reviewErrorTitle")}
                    </p>
                    <p className="callout-body">{reviewError}</p>
                  </div>
                </div>
              ) : null}
              {review && !reviewing ? (
                <CVReview review={review} modelName={modelName} />
              ) : null}
              <CVPreview
                html={previewHTML}
                title={t("builder.previewFrameTitle")}
                frameRef={printRef}
              />
              <p className="builder-hint builder-result-hint">
                {editingId ? t("builder.editingSaved") : t("builder.resultHint")}{" "}
                {t("builder.printHint")}
              </p>
            </>
          ) : (
            <EmptyState
              title={t("builder.resultEmptyTitle")}
              detail={t("builder.resultContentEmpty")}
            />
          )
        ) : (
          <EmptyState
            title={t("builder.resultEmptyTitle")}
            detail={t("builder.resultEmptyDetail")}
          />
        )}
      </section>
    </div>
  );
}
