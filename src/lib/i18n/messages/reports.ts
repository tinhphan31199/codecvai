import type { Message } from "../types";

const vi = {
  "reports.tab.candidates": "Báo cáo ứng viên",
  "reports.tab.distribution": "Phân bố hồ sơ",
  "reports.tab.quality": "Chất lượng JD",

  "reports.loading": "Đang tải báo cáo…",
  "reports.sub":
    "Báo cáo ứng viên, phân bố hồ sơ và chất lượng JD · cập nhật {updated}",
  "reports.rangeLabel": "Khoảng thời gian",
  "reports.range.today": "Hôm nay · 26/10",
  "reports.range.days7": "7 ngày qua",
  "reports.range.days30": "30 ngày qua",
  "reports.export": "Xuất báo cáo",

  "reports.kpi.label": "Tổng quan báo cáo",
  "reports.kpi.total": "Báo cáo trong kỳ",
  "reports.kpi.totalNote": "{count} phiên bản đã tạo",
  "reports.kpi.exportedNote": "Sẵn sàng chia sẻ với team",
  "reports.kpi.reviewNote": "Cần người review xác nhận",
  "reports.kpi.failed": "Lỗi tạo báo cáo",
  "reports.kpi.failedNote": "Cần cấp lại quyền repository",

  "reports.typeLabel": "Loại báo cáo",

  "reports.candidates.title": "Báo cáo ứng viên gần nhất",
  "reports.candidates.meta": "{count} báo cáo trong kỳ",
  "reports.candidates.exportCsv": "Xuất CSV",
  "reports.candidates.foot":
    "Hiển thị {shown}/{total} báo cáo gần nhất trong kỳ.",
  "reports.candidates.openList": "Mở danh sách ứng viên",
  "reports.candidates.emptyTitle":
    "Không có báo cáo trong khoảng thời gian này",
  "reports.candidates.emptyDetail":
    "Chọn khoảng thời gian rộng hơn để xem báo cáo đã tạo.",
  "reports.candidates.emptyAction": "Xem 30 ngày qua",

  "reports.col.candidate": "Ứng viên",
  "reports.col.code": "Mã báo cáo",
  "reports.col.position": "Vị trí",
  "reports.col.version": "Phiên bản",
  "reports.col.reviewer": "Người review",
  "reports.col.created": "Ngày tạo",
  "reports.col.status": "Trạng thái",
  "reports.col.download": "Tải báo cáo",
  "reports.downloadAria": "Tải báo cáo của {name}",

  "reports.distribution.statusTitle": "Phân bố theo trạng thái",
  "reports.distribution.statusMeta": "{count} hồ sơ · toàn workspace",
  "reports.distribution.statusFoot":
    "Phân bố theo {count} hồ sơ trong workspace.",
  "reports.distribution.positionTitle": "Hồ sơ theo vị trí",
  "reports.distribution.positionMeta": "{positions} vị trí · {count} hồ sơ",
  "reports.distribution.positionFoot":
    "Tổng khớp {count} hồ sơ trong workspace.",

  "reports.quality.title": "Tiêu chí theo vị trí",
  "reports.quality.meta": "{count} JD · nguồn xác minh",
  "reports.col.team": "Team",
  "reports.col.criteria": "Tiêu chí",
  "reports.col.must": "Bắt buộc",
  "reports.col.candidates": "Ứng viên",
  "reports.quality.foot":
    "Mọi tiêu chí đều có nguồn xác minh: CV, repository hoặc phỏng vấn.",
  "reports.quality.weakTitle": "Vị trí cần bổ sung tiêu chí",
  "reports.quality.weakMeta": "{count} vị trí dưới 4 tiêu chí",
  "reports.quality.weakSub": "{criteria} tiêu chí · {candidates} ứng viên",
  "reports.quality.weakPill": "Cần bổ sung",
  "reports.quality.weakFoot":
    "Thêm tiêu chí và nguồn xác minh trước khi mở phân tích hàng loạt.",
  "reports.quality.openJobs": "Mở Job Descriptions",

  "reports.csv.code": "Mã",
  "reports.csv.candidate": "Ứng viên",
  "reports.csv.position": "Vị trí",
  "reports.csv.version": "Phiên bản",
  "reports.csv.reviewer": "Người review",
  "reports.csv.created": "Ngày tạo",
  "reports.csv.status": "Trạng thái",

  "reports.exportMd.title": "# Báo cáo ứng viên — {name}",
  "reports.exportMd.summary": "## Tóm tắt",
  "reports.exportMd.evidence": "## Bằng chứng",
  "reports.exportMd.source": "Nguồn: {source}",
} as const;

const en: Record<keyof typeof vi, Message> = {
  "reports.tab.candidates": "Candidate reports",
  "reports.tab.distribution": "Candidate distribution",
  "reports.tab.quality": "JD quality",

  "reports.loading": "Loading reports…",
  "reports.sub":
    "Candidate reports, distribution and JD quality · updated {updated}",
  "reports.rangeLabel": "Time range",
  "reports.range.today": "Today · 26/10",
  "reports.range.days7": "Last 7 days",
  "reports.range.days30": "Last 30 days",
  "reports.export": "Export report",

  "reports.kpi.label": "Reports overview",
  "reports.kpi.total": "Reports this period",
  "reports.kpi.totalNote": {
    one: "{count} version created",
    other: "{count} versions created",
  },
  "reports.kpi.exportedNote": "Ready to share with the team",
  "reports.kpi.reviewNote": "Waiting for reviewer confirmation",
  "reports.kpi.failed": "Report generation errors",
  "reports.kpi.failedNote": "Repository access must be regranted",

  "reports.typeLabel": "Report type",

  "reports.candidates.title": "Latest candidate reports",
  "reports.candidates.meta": {
    one: "{count} report this period",
    other: "{count} reports this period",
  },
  "reports.candidates.exportCsv": "Export CSV",
  "reports.candidates.foot":
    "Showing {shown}/{total} latest reports this period.",
  "reports.candidates.openList": "Open candidate list",
  "reports.candidates.emptyTitle": "No reports in this period",
  "reports.candidates.emptyDetail":
    "Choose a wider time range to see generated reports.",
  "reports.candidates.emptyAction": "View last 30 days",

  "reports.col.candidate": "Candidate",
  "reports.col.code": "Report ID",
  "reports.col.position": "Position",
  "reports.col.version": "Version",
  "reports.col.reviewer": "Reviewer",
  "reports.col.created": "Created",
  "reports.col.status": "Status",
  "reports.col.download": "Download report",
  "reports.downloadAria": "Download {name}'s report",

  "reports.distribution.statusTitle": "Distribution by status",
  "reports.distribution.statusMeta": "{count} candidates · whole workspace",
  "reports.distribution.statusFoot":
    "Distribution across {count} candidates in the workspace.",
  "reports.distribution.positionTitle": "Candidates by position",
  "reports.distribution.positionMeta":
    "{positions} positions · {count} candidates",
  "reports.distribution.positionFoot":
    "Totals match {count} candidates in the workspace.",

  "reports.quality.title": "Criteria by position",
  "reports.quality.meta": {
    one: "{count} JD · source verification",
    other: "{count} JDs · source verification",
  },
  "reports.col.team": "Team",
  "reports.col.criteria": "Criteria",
  "reports.col.must": "Required",
  "reports.col.candidates": "Candidates",
  "reports.quality.foot":
    "Every criterion has a verified source: CV, repository or interview.",
  "reports.quality.weakTitle": "Positions needing more criteria",
  "reports.quality.weakMeta": {
    one: "{count} position with fewer than 4 criteria",
    other: "{count} positions with fewer than 4 criteria",
  },
  "reports.quality.weakSub": "{criteria} criteria · {candidates} candidates",
  "reports.quality.weakPill": "Needs more",
  "reports.quality.weakFoot":
    "Add criteria and sources before running bulk analysis.",
  "reports.quality.openJobs": "Open Job Descriptions",

  "reports.csv.code": "Code",
  "reports.csv.candidate": "Candidate",
  "reports.csv.position": "Position",
  "reports.csv.version": "Version",
  "reports.csv.reviewer": "Reviewer",
  "reports.csv.created": "Created",
  "reports.csv.status": "Status",

  "reports.exportMd.title": "# Candidate report — {name}",
  "reports.exportMd.summary": "## Summary",
  "reports.exportMd.evidence": "## Evidence",
  "reports.exportMd.source": "Source: {source}",
};

export const reportsMessages = { vi, en };
