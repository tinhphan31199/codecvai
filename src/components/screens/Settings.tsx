"use client";

import {
  Cpu,
  FileText,
  GraduationCap,
  ListOrdered,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { Screen } from "@/data/codecv";
import { PageHead } from "../ui";
import WorkspaceTab from "./settings/WorkspaceTab";
import TeamTab from "./settings/TeamTab";
import LevelsTab from "./settings/LevelsTab";
import PositionsTab from "./settings/PositionsTab";
import ModelsTab from "./settings/ModelsTab";
import StagesTab from "./settings/StagesTab";

const TABS = [
  {
    key: "workspace",
    label: "Workspace",
    icon: SlidersHorizontal,
    sub: "Tên workspace, reviewer, mô hình phân tích và các chỉ số hiển thị.",
  },
  {
    key: "team",
    label: "Thành viên",
    icon: Users,
    sub: "Danh mục thành viên dùng cho reviewer và phân quyền hiển thị.",
  },
  {
    key: "levels",
    label: "Cấp bậc",
    icon: GraduationCap,
    sub: "Cấp bậc dùng chung cho vị trí, Upload CV và phân tích hồ sơ.",
  },
  {
    key: "positions",
    label: "Vị trí",
    icon: FileText,
    sub: "Vị trí và bộ tiêu chí dùng khi phân tích CV.",
  },
  {
    key: "models",
    label: "AI models",
    icon: Cpu,
    sub: "Catalog model phân tích và trạng thái bật/tắt.",
  },
  {
    key: "stages",
    label: "Công đoạn",
    icon: ListOrdered,
    sub: "Các bước hiển thị trong luồng phân tích CV.",
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
  const active: SettingsTabKey = TABS.some((item) => item.key === tab)
    ? (tab as SettingsTabKey)
    : TABS[0].key;
  const meta = TABS.find((item) => item.key === active) ?? TABS[0];

  return (
    <div className="screen">
      <PageHead title="Settings" sub={meta.sub} />

      <nav className="settings-tabs" aria-label="Trang cấu hình">
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
              {item.label}
            </a>
          );
        })}
      </nav>

      {active === "workspace" ? <WorkspaceTab /> : null}
      {active === "team" ? <TeamTab /> : null}
      {active === "levels" ? <LevelsTab /> : null}
      {active === "positions" ? <PositionsTab /> : null}
      {active === "models" ? <ModelsTab /> : null}
      {active === "stages" ? <StagesTab /> : null}
    </div>
  );
}
