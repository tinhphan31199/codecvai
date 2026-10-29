"use client";

import { useSyncExternalStore } from "react";
import type { Message } from "./types";
import { commonMessages } from "./messages/common";
import { shellMessages } from "./messages/shell";
import { dashboardMessages } from "./messages/dashboard";
import { candidatesMessages } from "./messages/candidates";
import { candidateMessages } from "./messages/candidate";
import { uploadMessages } from "./messages/upload";
import { repositoryMessages } from "./messages/repository";
import { interviewMessages } from "./messages/interview";
import { jobsMessages } from "./messages/jobs";
import { reportsMessages } from "./messages/reports";
import { settingsMessages } from "./messages/settings";
import { settingsCrudMessages } from "./messages/settingsCrud";

export type Lang = "vi" | "en";

export type Vars = Record<string, string | number>;

const vi = {
  ...commonMessages.vi,
  ...shellMessages.vi,
  ...dashboardMessages.vi,
  ...candidatesMessages.vi,
  ...candidateMessages.vi,
  ...uploadMessages.vi,
  ...repositoryMessages.vi,
  ...interviewMessages.vi,
  ...jobsMessages.vi,
  ...reportsMessages.vi,
  ...settingsMessages.vi,
  ...settingsCrudMessages.vi,
};

const en: Record<keyof typeof vi, Message> = {
  ...commonMessages.en,
  ...shellMessages.en,
  ...dashboardMessages.en,
  ...candidatesMessages.en,
  ...candidateMessages.en,
  ...uploadMessages.en,
  ...repositoryMessages.en,
  ...interviewMessages.en,
  ...jobsMessages.en,
  ...reportsMessages.en,
  ...settingsMessages.en,
  ...settingsCrudMessages.en,
};

export type MessageKey = keyof typeof vi;

const dictionaries: Record<Lang, Record<MessageKey, Message>> = { vi, en };

const pluralRules: Record<Lang, Intl.PluralRules> = {
  vi: new Intl.PluralRules("vi-VN"),
  en: new Intl.PluralRules("en-US"),
};

export function localeOf(lang: Lang): string {
  return lang === "en" ? "en-US" : "vi-VN";
}

function format(
  lang: Lang,
  entry: Message,
  vars?: Vars,
): string {
  let text: string;
  if (typeof entry === "string") {
    text = entry;
  } else {
    const count = Number(vars?.count ?? 0);
    text = pluralRules[lang].select(count) === "one" ? entry.one : entry.other;
  }
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

export function translate(
  lang: Lang,
  key: MessageKey,
  vars?: Vars,
): string {
  const entry = dictionaries[lang][key] ?? dictionaries.vi[key];
  return entry === undefined ? key : format(lang, entry, vars);
}

const STORAGE_KEY = "codecv-lang";
const CHANGE_EVENT = "codecv-lang-change";

function readLang(): Lang {
  if (typeof window === "undefined") return "vi";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "vi") return stored;
  } catch {
    /* storage unavailable: fall back to Vietnamese */
  }
  return "vi";
}

function subscribeLang(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setLang(lang: Lang): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore storage errors */
  }
  document.documentElement.lang = lang;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, readLang, () => "vi" as Lang);
}

export function getLang(): Lang {
  return readLang();
}

export function useT(): (key: MessageKey, vars?: Vars) => string {
  const lang = useLang();
  return (key: MessageKey, vars?: Vars) => translate(lang, key, vars);
}

export function useLocaleDate(): (value: Date | number) => string {
  const lang = useLang();
  return (value: Date | number) =>
    new Intl.DateTimeFormat(localeOf(lang), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(value);
}

export function useNumberFormat(): (value: number) => string {
  const lang = useLang();
  return (value: number) =>
    new Intl.NumberFormat(localeOf(lang)).format(value);
}
