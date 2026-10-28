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
  Menu,
  MessagesSquare,
  Search,
  Settings as SettingsIcon,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import type { Screen } from "@/data/codecv";
import { useWorkspace } from "@/lib/api";
import { Avatar, LogoMark } from "./ui";
import Dashboard from "./screens/Dashboard";
import UploadCV from "./screens/UploadCV";
import Candidates from "./screens/Candidates";
import CandidateDetail from "./screens/CandidateDetail";
import RepositoryScreen from "./screens/Repository";
import InterviewStudio from "./screens/Interview";
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

const navItems = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard, count: null },
  { key: "candidates", label: "Candidates", icon: Users, count: 0 },
  { key: "upload", label: "CV Analysis", icon: UploadCloud, count: null },
  { key: "repository", label: "Repository Analysis", icon: FolderGit2, count: null },
  { key: "interview", label: "Interview Studio", icon: MessagesSquare, count: null },
  { key: "jobs", label: "Job Descriptions", icon: FileText, count: null },
  { key: "reports", label: "Reports", icon: BarChart3, count: null },
  { key: "settings", label: "Settings", icon: SettingsIcon, count: null },
];

const screenTitles: Record<Screen, string> = {
  overview: "Dashboard",
  upload: "CV Analysis",
  candidates: "Candidates",
  candidate: "Candidate",
  repository: "Repository Analysis",
  interview: "Interview Studio",
  jobs: "Job Descriptions",
  reports: "Reports",
  settings: "Settings",
};

const activeKey = (screen: Screen) =>
  screen === "candidate" ? "candidates" : screen;

export default function CodeCVApp() {
  const hash = useSyncExternalStore(subscribeHash, getHash, getServerHash);
  const route = useMemo(() => parseHash(hash), [hash]);
  const workspace = useWorkspace();
  const [navOpen, setNavOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [teamName, setTeamName] = useState("Product Engineering");
  const [listQuery, setListQuery] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
          aria-label="Đóng menu"
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
            <span className="workspace-sub">{workspace.positions} vị trí đang mở</span>
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

      <nav className="side-nav" aria-label="Điều hướng chính">
        <span className="nav-group">Workspace</span>
        {navItems.map((item) => {
          const Icon = item.icon;
          const on = current === item.key;
          const count = item.key === "candidates" ? workspace.review : item.count;
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
              <span className="nav-label">{item.label}</span>
              {count ? (
                <span
                  className="nav-count"
                  aria-label={`${count} hồ sơ chờ review`}
                >
                  {count}
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>

      <div className="side-foot">
        <a className="nav-item" href="#settings" onClick={(e) => { e.preventDefault(); go("settings"); }}>
          <HelpCircle size={16} aria-hidden="true" />
          <span className="nav-label">Trợ giúp & tài liệu</span>
        </a>
        <div className="account-row">
          <Avatar initials="MA" hue={243} size={30} name="Minh Anh" />
          <span className="account-main">
            <span className="account-name">Minh Anh</span>
            <span className="account-sub">Recruiter · Owner</span>
          </span>
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
          aria-label="Đóng menu"
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
            placeholder="Tìm ứng viên, repository, báo cáo…"
            aria-label="Tìm kiếm toàn workspace"
          />
          <kbd>/</kbd>
        </form>
        <div className="topbar-right">
          <span className="model-status">
            <span className="model-dot" aria-hidden="true" />
            {workspace.analysisModel}
          </span>
          <button type="button" className="icon-btn" aria-label="Thông báo">
            <Bell size={17} />
          </button>
          <button type="button" className="icon-btn" aria-label="Trợ giúp">
            <HelpCircle size={17} />
          </button>
          <Avatar initials="MA" hue={243} size={28} name="Minh Anh" />
        </div>
      </header>

      <div className="workspace">
        <div className="sheet" ref={sheetRef}>
          <header className="mobilebar">
            <button
              type="button"
              className="icon-btn"
              aria-label="Mở menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <Menu size={19} />
            </button>
            <span className="mobile-title">
              <LogoMark size={20} />
              {screenTitles[route.screen]}
            </span>
            <Avatar initials="MA" hue={243} size={26} name="Minh Anh" />
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
              <InterviewStudio
                key={route.id ?? "an"}
                id={route.id ?? "an"}
                go={go}
              />
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
