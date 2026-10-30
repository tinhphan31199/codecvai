"use client";

export interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GoogleButtonOptions {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    locale?: string;
    auto_select?: boolean;
    ux_mode?: "popup" | "redirect";
  }): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let pending: Promise<void> | null = null;

export function googleIdentity(): GoogleAccountsId | null {
  if (typeof window === "undefined") return null;
  return window.google?.accounts?.id ?? null;
}

// GIS loads a single global script; concurrent callers share one promise.
export function loadGoogleIdentity(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (googleIdentity()) return Promise.resolve();
  if (pending) return pending;
  pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      pending = null;
      reject(new Error("google identity script failed to load"));
    };
    document.head.appendChild(script);
  });
  return pending;
}
