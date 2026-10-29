import type { Message } from "../types";

const vi = {
  "nav.dashboard": "Tổng quan",
  "nav.candidates": "Ứng viên",
  "nav.upload": "Phân tích CV",
  "nav.repository": "Phân tích repository",
  "nav.interview": "Phòng phỏng vấn",
  "nav.jobs": "Vị trí tuyển dụng",
  "nav.reports": "Báo cáo",
  "nav.settings": "Cài đặt",

  "screen.dashboard": "Tổng quan",
  "screen.candidates": "Ứng viên",
  "screen.upload": "Phân tích CV",
  "screen.repository": "Phân tích repository",
  "screen.interview": "Phòng phỏng vấn",
  "screen.jobs": "Vị trí tuyển dụng",
  "screen.reports": "Báo cáo",
  "screen.settings": "Cài đặt",
  "screen.candidate": "Hồ sơ ứng viên",

  "shell.closeMenu": "Đóng menu",
  "shell.openMenu": "Mở menu",
  "shell.mainNav": "Điều hướng chính",
  "shell.workspaceGroup": "Workspace",
  "shell.positionsOpen": "{count} vị trí đang mở",
  "shell.reviewAria": "{count} hồ sơ chờ review",
  "shell.helpDocs": "Trợ giúp & tài liệu",
  "shell.accountRole": "Tuyển dụng · Chủ sở hữu",
  "shell.searchPlaceholder": "Tìm ứng viên, repository, báo cáo…",
  "shell.searchAria": "Tìm kiếm toàn workspace",
  "shell.notifications": "Thông báo",
  "shell.help": "Trợ giúp",
  "shell.modelFallback": "Chưa có model",
  "shell.language": "Ngôn ngữ",
  "shell.langVi": "Chuyển sang tiếng Việt",
  "shell.langEn": "Chuyển sang tiếng Anh",
  "shell.metaDescription":
    "Đánh giá ứng viên bằng bằng chứng: phân tích CV, repository, sinh câu hỏi phỏng vấn và rubric chấm điểm.",
} as const;

const en: Record<keyof typeof vi, Message> = {
  "nav.dashboard": "Dashboard",
  "nav.candidates": "Candidates",
  "nav.upload": "CV Analysis",
  "nav.repository": "Repository Analysis",
  "nav.interview": "Interview Studio",
  "nav.jobs": "Job Descriptions",
  "nav.reports": "Reports",
  "nav.settings": "Settings",

  "screen.dashboard": "Dashboard",
  "screen.candidates": "Candidates",
  "screen.upload": "CV Analysis",
  "screen.repository": "Repository Analysis",
  "screen.interview": "Interview Studio",
  "screen.jobs": "Job Descriptions",
  "screen.reports": "Reports",
  "screen.settings": "Settings",
  "screen.candidate": "Candidate",

  "shell.closeMenu": "Close menu",
  "shell.openMenu": "Open menu",
  "shell.mainNav": "Main navigation",
  "shell.workspaceGroup": "Workspace",
  "shell.positionsOpen": {
    one: "{count} open position",
    other: "{count} open positions",
  },
  "shell.reviewAria": {
    one: "{count} candidate in review",
    other: "{count} candidates in review",
  },
  "shell.helpDocs": "Help & docs",
  "shell.accountRole": "Recruiter · Owner",
  "shell.searchPlaceholder": "Search candidates, repositories, reports…",
  "shell.searchAria": "Search the whole workspace",
  "shell.notifications": "Notifications",
  "shell.help": "Help",
  "shell.modelFallback": "No model",
  "shell.language": "Language",
  "shell.langVi": "Switch to Vietnamese",
  "shell.langEn": "Switch to English",
  "shell.metaDescription":
    "Evidence-based candidate evaluation: CV analysis, repository review, interview questions and scoring rubrics.",
};

export const shellMessages = { vi, en };
