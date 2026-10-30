"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  fetchAuthConfig,
  loginUser,
  loginWithGoogle,
  registerUser,
} from "@/lib/api";
import { setLang, useLang, useT } from "@/lib/i18n";
import GoogleSignIn from "../GoogleSignIn";
import { LogoMark } from "../ui";

type Mode = "login" | "register";

export default function Login() {
  const t = useT();
  const lang = useLang();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t("auth.title");
  }, [lang, t]);

  useEffect(() => {
    let cancelled = false;
    fetchAuthConfig()
      .then((config) => {
        if (!cancelled) setGoogleClientId(config.googleClientId || null);
      })
      .catch(() => {
        if (!cancelled) setGoogleClientId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await loginUser(username.trim(), password);
      } else {
        await registerUser(username.trim(), password, displayName.trim());
      }
    } catch (err) {
      const fallback =
        mode === "login" ? t("auth.loginError") : t("auth.registerError");
      setError(err instanceof Error && err.message ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async (credential: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await loginWithGoogle(credential);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t("auth.googleError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div
        className="auth-lang lang-switch"
        role="group"
        aria-label={t("shell.language")}
      >
        <button
          type="button"
          className={`lang-option${lang === "vi" ? " is-on" : ""}`}
          aria-pressed={lang === "vi"}
          onClick={() => setLang("vi")}
        >
          VI
        </button>
        <button
          type="button"
          className={`lang-option${lang === "en" ? " is-on" : ""}`}
          aria-pressed={lang === "en"}
          onClick={() => setLang("en")}
        >
          EN
        </button>
      </div>

      <section className="auth-card" aria-labelledby="auth-title">
        <header className="auth-head">
          <LogoMark size={56} />
          <div className="auth-head-text">
            <span className="brand-name">CodeCV AI</span>
            <p className="auth-sub">{t("auth.subtitle")}</p>
          </div>
        </header>

        <h1 className="auth-title" id="auth-title">
          {t("auth.title")}
        </h1>

        <div className="auth-tabs" role="tablist" aria-label={t("auth.title")}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={`auth-tab${mode === "login" ? " is-on" : ""}`}
            onClick={() => switchMode("login")}
          >
            {t("auth.loginTab")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={`auth-tab${mode === "register" ? " is-on" : ""}`}
            onClick={() => switchMode("register")}
          >
            {t("auth.registerTab")}
          </button>
        </div>

        {mode === "login" && googleClientId ? (
          <>
            <GoogleSignIn
              clientId={googleClientId}
              text="signin_with"
              disabled={busy}
              onCredential={signInWithGoogle}
            />
            <div className="auth-divider" aria-hidden="true">
              <span>{t("auth.or")}</span>
            </div>
          </>
        ) : null}

        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">{t("auth.username")}</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t("auth.usernamePlaceholder")}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              minLength={3}
              maxLength={32}
              autoFocus
            />
          </label>

          {mode === "register" ? (
            <label className="field">
              <span className="field-label">{t("auth.displayName")}</span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
                maxLength={80}
                placeholder={t("auth.displayNameHint")}
              />
            </label>
          ) : null}

          <label className="field">
            <span className="field-label">{t("auth.password")}</span>
            <span className="auth-pass">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={mode === "register" ? 8 : undefined}
                maxLength={72}
              />
              <button
                type="button"
                className="auth-eye"
                aria-label={
                  showPassword ? t("auth.hidePassword") : t("auth.showPassword")
                }
                title={
                  showPassword ? t("auth.hidePassword") : t("auth.showPassword")
                }
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </span>
          </label>

          {mode === "register" ? (
            <p className="field-hint">
              {t("auth.usernameHint")} {t("auth.passwordHint")}
            </p>
          ) : null}

          {error ? (
            <p className="field-hint is-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="spin" size={15} aria-hidden="true" />
            ) : (
              <ArrowRight size={15} aria-hidden="true" />
            )}
            {busy
              ? mode === "login"
                ? t("auth.busyLogin")
                : t("auth.busyRegister")
              : mode === "login"
                ? t("auth.submitLogin")
                : t("auth.submitRegister")}
          </button>
        </form>
      </section>
    </div>
  );
}
