"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleIdentity } from "@/lib/google";
import { useLang, useT } from "@/lib/i18n";

type GoogleButtonText =
  | "signin_with"
  | "signup_with"
  | "continue_with"
  | "signin";

export default function GoogleSignIn({
  clientId,
  text = "continue_with",
  width = 320,
  disabled = false,
  onCredential,
}: {
  clientId: string;
  text?: GoogleButtonText;
  width?: number;
  disabled?: boolean;
  onCredential: (credential: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const host = useRef<HTMLDivElement | null>(null);
  const callback = useRef(onCredential);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;
    void loadGoogleIdentity()
      .then(() => {
        if (cancelled) return;
        const identity = window.google?.accounts?.id;
        const element = host.current;
        if (!identity || !element) {
          setFailed(true);
          return;
        }
        identity.initialize({
          client_id: clientId,
          locale: lang,
          callback: (response) => {
            if (response.credential) callback.current(response.credential);
          },
        });
        element.replaceChildren();
        identity.renderButton(element, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          shape: "pill",
          logo_alignment: "left",
          width: Math.min(400, Math.max(200, width)),
          locale: lang,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, lang, text, width]);

  if (failed) {
    return (
      <p className="field-hint is-error" role="alert">
        {t("auth.googleLoadError")}
      </p>
    );
  }

  return (
    <div
      ref={host}
      className={`google-slot${disabled ? " is-disabled" : ""}`}
      data-ready={ready ? "true" : "false"}
    />
  );
}
