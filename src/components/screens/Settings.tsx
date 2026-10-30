"use client";

import {
  Cpu,
  FileText,
  GraduationCap,
  Layers,
  ListOrdered,
  PlugZap,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import type { Screen } from "@/data/codecv";
import { useAuthSession } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { PageHead } from "../ui";
import SecurityTab from "./settings/SecurityTab";
import TeamTab from "./settings/TeamTab";
import LevelsTab from "./settings/LevelsTab";
import TeamsTab from "./settings/TeamsTab";
import PositionsTab from "./settings/PositionsTab";
import ModelsTab from "./settings/ModelsTab";
import ProvidersTab from "./settings/ProvidersTab";
import StagesTab from "./settings/StagesTab";
import UsersTab from "./settings/UsersTab";

const TABS = [
  {
    key: "security",
    labelKey: "settings.tab.security",
    icon: ShieldCheck,
    subKey: "settings.tab.securitySub",
  },
  {
    key: "users",
    labelKey: "settings.tab.users",
    icon: UserRound,
    subKey: "settings.tab.usersSub",
  },
  {
    key: "team",
    labelKey: "settings.tab.team",
    icon: Users,
    subKey: "settings.tab.teamSub",
  },
  {
    key: "levels",
    labelKey: "settings.tab.levels",
    icon: GraduationCap,
    subKey: "settings.tab.levelsSub",
  },
  {
    key: "teams",
    labelKey: "settings.tab.teams",
    icon: Layers,
    subKey: "settings.tab.teamsSub",
  },
  {
    key: "positions",
    labelKey: "settings.tab.positions",
    icon: FileText,
    subKey: "settings.tab.positionsSub",
  },
  {
    key: "models",
    labelKey: "settings.tab.models",
    icon: Cpu,
    subKey: "settings.tab.modelsSub",
  },
  {
    key: "providers",
    labelKey: "settings.tab.providers",
    icon: PlugZap,
    subKey: "settings.tab.providersSub",
  },
  {
    key: "stages",
    labelKey: "settings.tab.stages",
    icon: ListOrdered,
    subKey: "settings.tab.stagesSub",
  },
] as const;

type SettingsTabKey = (typeof TABS)[number]["key"];

export default function SettingsScreen({
  tab,
  go,
}: {
  tab?: string;
  go: (screen: Screen, id?: string) => void;
}) {
  const t = useT();
  const session = useAuthSession();
  const isAdmin = session?.user.role === "admin";
  const tabs = isAdmin ? TABS : TABS.filter((item) => item.key === "security");
  const active: SettingsTabKey = tabs.some((item) => item.key === tab)
    ? (tab as SettingsTabKey)
    : tabs[0].key;
  const meta = tabs.find((item) => item.key === active) ?? tabs[0];

  return (
    <div className="screen">
      <PageHead title={t("screen.settings")} sub={t(meta.subKey)} />

      <nav className="settings-tabs" aria-label={t("settings.tabsAria")}>
        {tabs.map((item) => {
          const Icon = item.icon;
          const on = item.key === active;
          return (
            <a
              key={item.key}
              href={`#settings/${item.key}`}
              className={`settings-tab${on ? " is-on" : ""}`}
              aria-current={on ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                go("settings", item.key);
              }}
            >
              <Icon size={14} aria-hidden="true" />
              {t(item.labelKey)}
            </a>
          );
        })}
      </nav>

      {active === "security" ? <SecurityTab /> : null}
      {active === "users" ? <UsersTab /> : null}
      {active === "team" ? <TeamTab /> : null}
      {active === "levels" ? <LevelsTab /> : null}
      {active === "teams" ? <TeamsTab /> : null}
      {active === "positions" ? <PositionsTab /> : null}
      {active === "models" ? <ModelsTab /> : null}
      {active === "providers" ? <ProvidersTab /> : null}
      {active === "stages" ? <StagesTab /> : null}
    </div>
  );
}
