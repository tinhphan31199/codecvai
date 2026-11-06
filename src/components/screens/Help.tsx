"use client";

import {
  BadgeCheck,
  Cpu,
  FileText,
  GitBranch,
  GraduationCap,
  HelpCircle,
  Info,
  Layers,
  ListOrdered,
  MessagesSquare,
  PlugZap,
  Rocket,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
import type { Screen } from "@/data/codecv";
import { useAuthSession } from "@/lib/auth";
import { useT, type MessageKey } from "@/lib/i18n";
import { ArrowLink, CardHead, EvidencePill, PageHead } from "../ui";

const TOC: { id: string; key: MessageKey; icon: typeof Rocket }[] = [
  { id: "help-start", key: "help.toc.start", icon: Rocket },
  { id: "help-pipeline", key: "help.toc.pipeline", icon: Workflow },
  { id: "help-evidence", key: "help.toc.evidence", icon: BadgeCheck },
  { id: "help-repo", key: "help.toc.repo", icon: GitBranch },
  { id: "help-interview", key: "help.toc.interview", icon: MessagesSquare },
  { id: "help-cv", key: "help.toc.cv", icon: Sparkles },
  { id: "help-roles", key: "help.toc.roles", icon: ShieldCheck },
  { id: "help-settings", key: "help.toc.settings", icon: SlidersHorizontal },
  { id: "help-faq", key: "help.toc.faq", icon: HelpCircle },
];

const STEPS: {
  titleKey: MessageKey;
  textKey: MessageKey;
  actionKey: MessageKey;
  screen: Screen;
}[] = [
  {
    titleKey: "help.start.s1.title",
    textKey: "help.start.s1.text",
    actionKey: "help.start.s1.action",
    screen: "upload",
  },
  {
    titleKey: "help.start.s2.title",
    textKey: "help.start.s2.text",
    actionKey: "help.start.s2.action",
    screen: "candidates",
  },
  {
    titleKey: "help.start.s3.title",
    textKey: "help.start.s3.text",
    actionKey: "help.start.s3.action",
    screen: "interview",
  },
  {
    titleKey: "help.start.s4.title",
    textKey: "help.start.s4.text",
    actionKey: "help.start.s4.action",
    screen: "reports",
  },
];

const PIPELINE: { titleKey: MessageKey; textKey: MessageKey }[] = [
  { titleKey: "help.pipeline.1.title", textKey: "help.pipeline.1.text" },
  { titleKey: "help.pipeline.2.title", textKey: "help.pipeline.2.text" },
  { titleKey: "help.pipeline.3.title", textKey: "help.pipeline.3.text" },
  { titleKey: "help.pipeline.4.title", textKey: "help.pipeline.4.text" },
  { titleKey: "help.pipeline.5.title", textKey: "help.pipeline.5.text" },
  { titleKey: "help.pipeline.6.title", textKey: "help.pipeline.6.text" },
];

const EVIDENCE: {
  state: "verified" | "inferred" | "missing";
  textKey: MessageKey;
}[] = [
  { state: "verified", textKey: "help.evidence.verified.text" },
  { state: "inferred", textKey: "help.evidence.inferred.text" },
  { state: "missing", textKey: "help.evidence.missing.text" },
];

const REPO_POINTS: MessageKey[] = [
  "help.repo.b1",
  "help.repo.b2",
  "help.repo.b3",
  "help.repo.b4",
];

const INTERVIEW_POINTS: MessageKey[] = [
  "help.interview.b1",
  "help.interview.b2",
  "help.interview.b3",
  "help.interview.b4",
];

const CV_POINTS: MessageKey[] = [
  "help.cv.b1",
  "help.cv.b2",
  "help.cv.b3",
  "help.cv.b4",
];

const SETTINGS_LINKS: {
  tab: string;
  labelKey: MessageKey;
  subKey: MessageKey;
  icon: typeof ShieldCheck;
}[] = [
  {
    tab: "security",
    labelKey: "settings.tab.security",
    subKey: "settings.tab.securitySub",
    icon: ShieldCheck,
  },
  {
    tab: "users",
    labelKey: "settings.tab.users",
    subKey: "settings.tab.usersSub",
    icon: UserRound,
  },
  {
    tab: "team",
    labelKey: "settings.tab.team",
    subKey: "settings.tab.teamSub",
    icon: Users,
  },
  {
    tab: "levels",
    labelKey: "settings.tab.levels",
    subKey: "settings.tab.levelsSub",
    icon: GraduationCap,
  },
  {
    tab: "teams",
    labelKey: "settings.tab.teams",
    subKey: "settings.tab.teamsSub",
    icon: Layers,
  },
  {
    tab: "positions",
    labelKey: "settings.tab.positions",
    subKey: "settings.tab.positionsSub",
    icon: FileText,
  },
  {
    tab: "models",
    labelKey: "settings.tab.models",
    subKey: "settings.tab.modelsSub",
    icon: Cpu,
  },
  {
    tab: "providers",
    labelKey: "settings.tab.providers",
    subKey: "settings.tab.providersSub",
    icon: PlugZap,
  },
  {
    tab: "stages",
    labelKey: "settings.tab.stages",
    subKey: "settings.tab.stagesSub",
    icon: ListOrdered,
  },
];

const FAQ: { q: MessageKey; a: MessageKey }[] = [
  { q: "help.faq.q1", a: "help.faq.a1" },
  { q: "help.faq.q2", a: "help.faq.a2" },
  { q: "help.faq.q3", a: "help.faq.a3" },
  { q: "help.faq.q4", a: "help.faq.a4" },
  { q: "help.faq.q5", a: "help.faq.a5" },
  { q: "help.faq.q6", a: "help.faq.a6" },
  { q: "help.faq.q7", a: "help.faq.a7" },
  { q: "help.faq.q8", a: "help.faq.a8" },
];

export default function Help({
  go,
}: {
  go: (screen: Screen, id?: string) => void;
}) {
  const t = useT();
  const session = useAuthSession();
  const role = session?.user.role;
  const isAdmin = role === "admin";

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="screen">
      <PageHead
        title={t("screen.help")}
        sub={t("help.sub")}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => go("upload")}
          >
            <UploadCloud size={15} aria-hidden="true" />
            {t("help.cta")}
          </button>
        }
      />

      <div className="help-layout">
        <aside className="help-toc card">
          <span className="help-toc-title">{t("help.toc")}</span>
          <nav aria-label={t("help.tocAria")}>
            {TOC.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="help-toc-link"
                  onClick={() => jump(item.id)}
                >
                  <Icon size={14} aria-hidden="true" />
                  {t(item.key)}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="help-main">
          <section id="help-start" className="card anchor-section">
            <CardHead
              title={t("help.start.title")}
              meta={t("help.start.meta")}
            />
            <ol className="help-steps">
              {STEPS.map((step, index) => (
                <li className="help-step" key={step.titleKey}>
                  <span className="help-step-num num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="help-step-title">{t(step.titleKey)}</h3>
                    <p className="help-step-text">{t(step.textKey)}</p>
                  </div>
                  <div className="help-step-action">
                    <ArrowLink onClick={() => go(step.screen)}>
                      {t(step.actionKey)}
                    </ArrowLink>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="help-pipeline" className="card anchor-section">
            <CardHead
              title={t("help.pipeline.title")}
              meta={t("help.pipeline.meta")}
            />
            <ol className="help-steps">
              {PIPELINE.map((stage, index) => (
                <li className="help-step" key={stage.titleKey}>
                  <span className="help-step-num num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="help-step-title">{t(stage.titleKey)}</h3>
                    <p className="help-step-text">{t(stage.textKey)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="help-evidence" className="card anchor-section">
            <CardHead
              title={t("help.evidence.title")}
              meta={t("help.evidence.meta")}
            />
            <div className="help-evidence-rows">
              {EVIDENCE.map((item) => (
                <div className="help-evidence-row" key={item.state}>
                  <EvidencePill state={item.state} />
                  <p className="help-evidence-text">{t(item.textKey)}</p>
                </div>
              ))}
            </div>
            <p className="screen-note">{t("help.evidence.note")}</p>
          </section>

          <section id="help-repo" className="card anchor-section">
            <CardHead
              title={t("help.repo.title")}
              meta={t("help.repo.meta")}
              action={
                <ArrowLink onClick={() => go("repository")}>
                  {t("help.repo.action")}
                </ArrowLink>
              }
            />
            <ul className="help-list">
              {REPO_POINTS.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
            <div className="help-callout">
              <Info size={15} aria-hidden="true" />
              <span>{t("help.repo.callout")}</span>
            </div>
          </section>

          <section id="help-interview" className="card anchor-section">
            <CardHead
              title={t("help.interview.title")}
              meta={t("help.interview.meta")}
              action={
                <ArrowLink onClick={() => go("interview")}>
                  {t("help.interview.action")}
                </ArrowLink>
              }
            />
            <ul className="help-list">
              {INTERVIEW_POINTS.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </section>

          <section id="help-cv" className="card anchor-section">
            <CardHead
              title={t("help.cv.title")}
              meta={t("help.cv.meta")}
              action={
                <ArrowLink onClick={() => go("builder")}>
                  {t("help.cv.action")}
                </ArrowLink>
              }
            />
            <ul className="help-list">
              {CV_POINTS.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
            <div className="help-callout">
              <Info size={15} aria-hidden="true" />
              <span>{t("help.cv.callout")}</span>
            </div>
          </section>

          <section id="help-roles" className="card anchor-section">
            <CardHead
              title={t("help.roles.title")}
              meta={t("help.roles.meta")}
            />
            <div className="help-role-grid">
              <div
                className={`help-role${role === "admin" ? " is-you" : ""}`}
              >
                <div className="help-role-head">
                  <ShieldCheck size={15} aria-hidden="true" />
                  {t("help.roles.admin.title")}
                  {role === "admin" ? (
                    <span className="help-role-tag">{t("help.roles.you")}</span>
                  ) : null}
                </div>
                <p className="help-role-text">{t("help.roles.admin.text")}</p>
              </div>
              <div
                className={`help-role${role === "member" ? " is-you" : ""}`}
              >
                <div className="help-role-head">
                  <UserRound size={15} aria-hidden="true" />
                  {t("help.roles.member.title")}
                  {role === "member" ? (
                    <span className="help-role-tag">{t("help.roles.you")}</span>
                  ) : null}
                </div>
                <p className="help-role-text">{t("help.roles.member.text")}</p>
              </div>
            </div>
            <p className="screen-note">{t("help.roles.note")}</p>
          </section>

          <section id="help-settings" className="card anchor-section">
            <CardHead
              title={t("help.settings.title")}
              meta={
                isAdmin
                  ? t("help.settings.meta")
                  : t("help.settings.metaMember")
              }
            />
            {isAdmin ? (
              <div className="help-links">
                {SETTINGS_LINKS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.tab}
                      type="button"
                      className="help-link-row"
                      onClick={() => go("settings", item.tab)}
                    >
                      <Icon size={15} aria-hidden="true" />
                      <span className="help-link-main">
                        <span className="help-link-label">
                          {t(item.labelKey)}
                        </span>
                        <span className="help-link-sub">{t(item.subKey)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="help-callout">
                  <Info size={15} aria-hidden="true" />
                  <span>{t("help.settings.memberNote")}</span>
                </div>
                <div className="help-action-row">
                  <ArrowLink onClick={() => go("settings", "security")}>
                    {t("help.settings.memberAction")}
                  </ArrowLink>
                </div>
              </>
            )}
          </section>

          <section id="help-faq" className="card anchor-section">
            <CardHead title={t("help.faq.title")} meta={t("help.faq.meta")} />
            <div className="help-faq-list">
              {FAQ.map((item) => (
                <details className="help-faq" key={item.q}>
                  <summary>{t(item.q)}</summary>
                  <p className="help-faq-body">{t(item.a)}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>

      <p className="screen-note">{t("help.foot")}</p>
    </div>
  );
}
