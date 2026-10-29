"use client";

import {
  Cpu,
  FileText,
  GraduationCap,
  ListOrdered,
  PlugZap,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Screen } from "@/data/codecv";
import { useT } from "@/lib/i18n";
import { PageHead } from "../ui";
import SecurityTab from "./settings/SecurityTab";
import TeamTab from "./settings/TeamTab";
import LevelsTab from "./settings/LevelsTab";
import PositionsTab from "./settings/PositionsTab";
import ModelsTab from "./settings/ModelsTab";
import ProvidersTab from "./settings/ProvidersTab";
import StagesTab from "./settings/StagesTab";

const TABS = [
  {
    key: "security",
    labelKey: "settings.tab.security",
    icon: ShieldCheck,
    subKey: "settings.tab.securitySub",
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
  const active: SettingsTabKey = TABS.some((item) => item.key === tab)
    ? (tab as SettingsTabKey)
    : TABS[0].key;
  const meta = TABS.find((item) => item.key === active) ?? TABS[0];

  return (
    <div className="screen">
      <PageHead title={t("screen.settings")} sub={t(meta.subKey)} />

      <nav className="settings-tabs" aria-label={t("settings.tabsAria")}>
        {TABS.map((item) => {
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
      {active === "team" ? <TeamTab /> : null}
      {active === "levels" ? <LevelsTab /> : null}
      {active === "positions" ? <PositionsTab /> : null}
      {active === "models" ? <ModelsTab /> : null}
      {active === "providers" ? <ProvidersTab /> : null}
      {active === "stages" ? <StagesTab /> : null}
    </div>
  );
}
