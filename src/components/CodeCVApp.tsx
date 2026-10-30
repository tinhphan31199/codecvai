"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  BarChart3,
  Bell,
  ChevronDown,
  FileText,
  FolderGit2,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  MessagesSquare,
  Search,
  Settings as SettingsIcon,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import type { Screen } from "@/data/codecv";
import { clearApiCache, fetchMe, useModels, useStats } from "@/lib/api";
import {
  clearSession,
  hueOf,
  initialsOf,
  saveSessionUser,
  useAuthReady,
  useAuthSession,
} from "@/lib/auth";
import { setLang, translate, useLang, useT, type MessageKey } from "@/lib/i18n";
import { Avatar, LogoMark } from "./ui";
import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";
import UploadCV from "./screens/UploadCV";
import Candidates from "./screens/Candidates";
import CandidateDetail from "./screens/CandidateDetail";
import RepositoryScreen from "./screens/Repository";
import InterviewStudio, { InterviewPicker } from "./screens/Interview";
import Jobs from "./screens/Jobs";
import Reports from "./screens/Reports";
import SettingsScreen from "./screens/Settings";

type Route = { screen: Screen; id?: string };

const ROUTES: Screen[] = [
  "overview",
  "upload",
  "candidates",
  "candidate",
  "repository",
  "interview",
  "jobs",
  "reports",
  "settings",
];

function parseHash(rawHash: string): Route {
  const raw = rawHash.replace(/^#\/?/, "");
  const [screen, id] = raw.split("/");
  if (ROUTES.includes(screen as Screen)) {
    return { screen: screen as Screen, id };
  }
  return { screen: "overview" };
}

const subscribeHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

const getHash = () => window.location.hash;
const getServerHash = () => "";

const navItems: {
  key: Screen;
  labelKey: MessageKey;
  icon: typeof LayoutDashboard;
  count: number | null;
}[] = [
  { key: "overview", labelKey: "nav.dashboard", icon: LayoutDashboard, count: null },
  { key: "candidates", labelKey: "nav.candidates", icon: Users, count: 0 },
  { key: "upload", labelKey: "nav.upload", icon: UploadCloud, count: null },
  { key: "repository", labelKey: "nav.repository", icon: FolderGit2, count: null },
  { key: "interview", labelKey: "nav.interview", icon: MessagesSquare, count: null },
  { key: "jobs", labelKey: "nav.jobs", icon: FileText, count: null },
  { key: "reports", labelKey: "nav.reports", icon: BarChart3, count: null },
  { key: "settings", labelKey: "nav.settings", icon: SettingsIcon, count: null },
];

const screenTitles: Record<Screen, MessageKey> = {
  overview: "screen.dashboard",
  upload: "screen.upload",
  candidates: "screen.candidates",
  candidate: "screen.candidate",
  repository: "screen.repository",
  interview: "screen.interview",
  jobs: "screen.jobs",
  reports: "screen.reports",
  settings: "screen.settings",
};

const activeKey = (screen: Screen) =>
  screen === "candidate" ? "candidates" : screen;

export default function CodeCVApp() {
  const session = useAuthSession();
  const ready = useAuthReady();
  const t = useT();

  useEffect(() => {
    if (!session?.token) return;
    let cancelled = false;
    fetchMe()
      .then((user) => {
        if (!cancelled) saveSessionUser(user);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  if (!ready) {
    return (
      <div className="auth-boot" role="status">
        <LogoMark size={28} />
        <span>{t("auth.bootLoading")}</span>
      </div>
    );
  }
  if (!session) return <Login />;
  return <Shell />;
}

function Shell() {
  const session = useAuthSession();
  const user = session?.user ?? null;
  const displayName = user?.displayName || user?.username || "—";
  const avatarInitials = initialsOf(displayName);
  const avatarHue = hueOf(user?.username ?? "codecv");
  const logout = () => {
    clearSession();
    clearApiCache();
  };
  const hash = useSyncExternalStore(subscribeHash, getHash, getServerHash);
  const route = useMemo(() => parseHash(hash), [hash]);
  const stats = useStats();
  const models = useModels();
  const activeModels = (models.data ?? []).filter((model) => model.active);
  const activeModel =
    activeModels.find((model) => model.apiKeySet) ?? activeModels[0];
  const t = useT();
  const lang = useLang();
  const [navOpen, setNavOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [teamName, setTeamName] = useState("Product Engineering");
  const [listQuery, setListQuery] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.title = `${translate(lang, screenTitles[route.screen])} · CodeCV AI`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", translate(lang, "shell.metaDescription"));
  }, [lang, route.screen]);

  useEffect(() => {
    const onHash = () => {
      setNavOpen(false);
      sheetRef.current?.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback((screen: Screen, id?: string) => {
    const next = `#${screen}${id ? `/${id}` : ""}`;
    setNavOpen(false);
    if (window.location.hash === next) {
      sheetRef.current?.scrollTo({ top: 0 });
    } else {
      window.location.hash = next;
    }
  }, []);

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setListQuery(searchValue);
    go("candidates");
  };

  const current = activeKey(route.screen);

  const nav = (
    <>
      <div className="side-brand">
        <LogoMark />
        <div className="brand-text">
          <span className="brand-name">CodeCV AI</span>
          <span className="brand-sub">Recruitment intelligence</span>
        </div>
        <button
          type="button"
          className="icon-btn side-close"
          onClick={() => setNavOpen(false)}
          aria-label={t("shell.closeMenu")}
        >
          <X size={18} />
        </button>
      </div>

      <div className="workspace-wrap">
        <button
          type="button"
          className="workspace-btn"
          aria-expanded={workspaceOpen}
          aria-haspopup="menu"
          onClick={() => setWorkspaceOpen((v) => !v)}
        >
          <span className="workspace-main">
            <span className="workspace-name">{teamName}</span>
            <span className="workspace-sub">
              {t("shell.positionsOpen", { count: stats.positions })}
            </span>
          </span>
          <ChevronDown size={15} aria-hidden="true" />
        </button>
        {workspaceOpen ? (
          <div className="workspace-menu" role="menu">
            {["Product Engineering", "Growth", "Platform"].map((name) => (
              <button
                key={name}
                type="button"
                role="menuitem"
                className={`workspace-option${name === teamName ? " is-active" : ""}`}
                onClick={() => {
                  setTeamName(name);
                  setWorkspaceOpen(false);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <nav className="side-nav" aria-label={t("shell.mainNav")}>
        <span className="nav-group">{t("shell.workspaceGroup")}</span>
        {navItems.map((item) => {
          const Icon = item.icon;
          const on = current === item.key;
          const count = item.key === "candidates" ? stats.review : item.count;
          return (
            <a
              key={item.key}
              href={`#${item.key}`}
              className={`nav-item${on ? " is-on" : ""}`}
              aria-current={on ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                go(item.key as Screen);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="nav-label">{t(item.labelKey)}</span>
              {count ? (
                <span
                  className="nav-count"
                  aria-label={t("shell.reviewAria", { count })}
                >
                  {count}
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>

      <div className="side-foot">
        <div className="lang-switch" role="group" aria-label={t("shell.language")}>
          <button
            type="button"
            className={`lang-option${lang === "vi" ? " is-on" : ""}`}
            aria-pressed={lang === "vi"}
            aria-label={t("shell.langVi")}
            onClick={() => setLang("vi")}
          >
            VI
          </button>
          <button
            type="button"
            className={`lang-option${lang === "en" ? " is-on" : ""}`}
            aria-pressed={lang === "en"}
            aria-label={t("shell.langEn")}
            onClick={() => setLang("en")}
          >
            EN
          </button>
        </div>
        <a className="nav-item" href="#settings" onClick={(e) => { e.preventDefault(); go("settings"); }}>
          <HelpCircle size={16} aria-hidden="true" />
          <span className="nav-label">{t("shell.helpDocs")}</span>
        </a>
        <div className="account-row">
          <Avatar
            initials={avatarInitials}
            hue={avatarHue}
            size={30}
            name={displayName}
          />
          <span className="account-main">
            <span className="account-name">{displayName}</span>
            <span className="account-sub">
              {user ? `@${user.username}` : t("shell.accountRole")}
            </span>
          </span>
          <button
            type="button"
            className="icon-btn account-logout"
            aria-label={t("auth.logout")}
            title={t("auth.logout")}
            onClick={logout}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar${navOpen ? " is-open" : ""}`}>{nav}</aside>

      {navOpen ? (
        <button
          type="button"
          className="nav-scrim"
          aria-label={t("shell.closeMenu")}
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <header className="topbar">
        <form className="global-search" onSubmit={onSearch} role="search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={t("shell.searchPlaceholder")}
            aria-label={t("shell.searchAria")}
          />
          <kbd>/</kbd>
        </form>
        <div className="topbar-right">
          <span className="model-status">
            <span className="model-dot" aria-hidden="true" />
            {activeModel?.name ?? t("shell.modelFallback")}
          </span>
          <button type="button" className="icon-btn" aria-label={t("shell.notifications")}>
            <Bell size={17} />
          </button>
          <button type="button" className="icon-btn" aria-label={t("shell.help")}>
            <HelpCircle size={17} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("auth.logout")}
            title={t("auth.logout")}
            onClick={logout}
          >
            <LogOut size={17} />
          </button>
          <Avatar
            initials={avatarInitials}
            hue={avatarHue}
            size={28}
            name={displayName}
          />
        </div>
      </header>

      <div className="workspace">
        <div className="sheet" ref={sheetRef}>
          <header className="mobilebar">
            <button
              type="button"
              className="icon-btn"
              aria-label={t("shell.openMenu")}
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <Menu size={19} />
            </button>
            <span className="mobile-title">
              <LogoMark size={20} />
              {t(screenTitles[route.screen])}
            </span>
            <Avatar
              initials={avatarInitials}
              hue={avatarHue}
              size={26}
              name={displayName}
            />
          </header>

          <div className="canvas">
            {route.screen === "overview" ? <Dashboard go={go} teamName={teamName} /> : null}
            {route.screen === "upload" ? <UploadCV go={go} /> : null}
            {route.screen === "candidates" ? (
              <Candidates
                go={go}
                query={listQuery}
                setQuery={setListQuery}
              />
            ) : null}
            {route.screen === "candidate" ? (
              <CandidateDetail key={route.id ?? "an"} id={route.id ?? "an"} go={go} />
            ) : null}
            {route.screen === "repository" ? (
              <RepositoryScreen
                key={route.id ?? ""}
                id={route.id}
                go={go}
              />
            ) : null}
            {route.screen === "interview" ? (
              route.id ? (
                <InterviewStudio key={route.id} id={route.id} go={go} />
              ) : (
                <InterviewPicker go={go} />
              )
            ) : null}
            {route.screen === "jobs" ? <Jobs go={go} /> : null}
            {route.screen === "reports" ? <Reports go={go} /> : null}
            {route.screen === "settings" ? (
              <SettingsScreen tab={route.id} go={go} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
