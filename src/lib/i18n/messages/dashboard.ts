import type { Message } from "../types";

const vi = {
  "dashboard.sub": "{team} · {date} · {count} hồ sơ trong workspace",
  "dashboard.updatedAt": "Cập nhật {time}",
  "dashboard.newAnalysis": "Phân tích CV mới",
  "dashboard.noData": "Không có dữ liệu.",
  "dashboard.kpi.label": "Tổng quan hoạt động",

  "dashboard.kpi.total": "Tổng ứng viên",
  "dashboard.kpi.positions": "{count} vị trí đang mở",
  "dashboard.kpi.processing": "Đang phân tích",
  "dashboard.kpi.processingNote": "Tiến độ theo từng công đoạn",
  "dashboard.kpi.completed": "Báo cáo hoàn tất",
  "dashboard.kpi.completedNote": "Sẵn sàng để đọc và xuất",
  "dashboard.kpi.review": "Chờ review",
  "dashboard.kpi.overdue": "{count} hồ sơ chờ hơn 24 giờ",
  "dashboard.kpi.overdueNone": "Không có hồ sơ quá 24 giờ",

  "dashboard.review.title": "Chờ bạn review",
  "dashboard.review.meta": "{count} hồ sơ · {overdue} hồ sơ chờ hơn 24 giờ",
  "dashboard.review.metaNone": "{count} hồ sơ · không có hồ sơ quá 24 giờ",
  "dashboard.review.evidence":
    "{covered}/{total} tiêu chí có bằng chứng · {missing} cần xác minh",
  "dashboard.review.openAria": "Mở hồ sơ {name}",
  "dashboard.review.oldest": "Hồ sơ chờ review lâu nhất: {name} · {duration}",
  "dashboard.review.days": "{count} ngày",
  "dashboard.review.emptyTitle": "Chưa có hồ sơ chờ review",
  "dashboard.review.emptyDetail":
    "Hồ sơ phân tích xong sẽ xuất hiện ở đây để bạn duyệt.",
  "dashboard.review.emptyFoot": "Hàng đợi review đang trống.",
  "dashboard.review.rowMeta": "{position} · cập nhật {updated}",
  "dashboard.review.openQueue": "Mở hàng đợi",

  "dashboard.processing.title": "Đang phân tích",
  "dashboard.processing.meta": "{count} hồ sơ · cập nhật theo công đoạn",
  "dashboard.processing.viewProgress": "Xem tiến độ",
  "dashboard.processing.emptyTitle": "Không có hồ sơ đang phân tích",
  "dashboard.processing.emptyDetail":
    "Tải CV mới để bắt đầu một lượt phân tích.",
  "dashboard.processing.note":
    "Tiến độ hiển thị theo công đoạn, không phải phần trăm ước lượng.",
  "dashboard.stage.0": "Đang đọc CV.pdf",
  "dashboard.stage.1": "Đang trích xuất nội dung CV",
  "dashboard.stage.2": "Đang so khớp tiêu chí JD",
  "dashboard.stage.3": "Đang phân tích repository",
  "dashboard.stage.4": "Đang tạo câu hỏi phỏng vấn",
  "dashboard.stage.5": "Đang tạo báo cáo",
  "dashboard.stage.running": "Đang chạy",

  "dashboard.recent.title": "Ứng viên gần đây",
  "dashboard.recent.meta": "{count} hồ sơ mới nhất",
  "dashboard.recent.colCandidate": "Ứng viên",
  "dashboard.recent.colPosition": "Vị trí",
  "dashboard.recent.colEvidence": "Bằng chứng",
  "dashboard.recent.colStatus": "Trạng thái",
  "dashboard.recent.colUpdated": "Cập nhật",
  "dashboard.recent.emptyTitle": "Chưa có hồ sơ hoàn tất",
  "dashboard.recent.emptyDetail":
    "Hồ sơ đã review hoặc hoàn tất sẽ hiện ở đây.",

  "dashboard.positions.title": "Hồ sơ theo vị trí",
  "dashboard.positions.meta": "Tổng {count} hồ sơ",
  "dashboard.positions.link": "Vị trí",
  "dashboard.positions.more": "+{count} hồ sơ ở {positions} vị trí khác",
  "dashboard.positions.emptyTitle": "Chưa có vị trí nào",
  "dashboard.positions.emptyDetail":
    "Tạo vị trí trong mục Vị trí để gắn hồ sơ và tiêu chí.",

  "dashboard.note.title": "Cần chú ý.",
  "dashboard.note.body":
    "{count} hồ sơ chờ review đã quá 24 giờ; ưu tiên mở {name} trước để không giữ ứng viên chờ lâu.",
} as const;

const en: Record<keyof typeof vi, Message> = {
  "dashboard.sub": {
    one: "{team} · {date} · {count} candidate in workspace",
    other: "{team} · {date} · {count} candidates in workspace",
  },
  "dashboard.updatedAt": "Updated {time}",
  "dashboard.newAnalysis": "Analyze new CV",
  "dashboard.noData": "No data available.",
  "dashboard.kpi.label": "Activity overview",

  "dashboard.kpi.total": "Total candidates",
  "dashboard.kpi.positions": {
    one: "{count} open position",
    other: "{count} open positions",
  },
  "dashboard.kpi.processing": "Analyzing",
  "dashboard.kpi.processingNote": "Progress by stage",
  "dashboard.kpi.completed": "Completed reports",
  "dashboard.kpi.completedNote": "Ready to read and export",
  "dashboard.kpi.review": "In review",
  "dashboard.kpi.overdue": {
    one: "{count} candidate waiting over 24 hours",
    other: "{count} candidates waiting over 24 hours",
  },
  "dashboard.kpi.overdueNone": "No candidates overdue",

  "dashboard.review.title": "Waiting for your review",
  "dashboard.review.meta": {
    one: "{count} candidate · {overdue} overdue",
    other: "{count} candidates · {overdue} overdue",
  },
  "dashboard.review.metaNone": {
    one: "{count} candidate · none overdue",
    other: "{count} candidates · none overdue",
  },
  "dashboard.review.evidence":
    "{covered}/{total} criteria with evidence · {missing} to verify",
  "dashboard.review.openAria": "Open {name}'s profile",
  "dashboard.review.oldest": "Longest waiting: {name} · {duration}",
  "dashboard.review.days": {
    one: "{count} day",
    other: "{count} days",
  },
  "dashboard.review.emptyTitle": "No candidates waiting for review",
  "dashboard.review.emptyDetail":
    "Candidates appear here once their analysis finishes.",
  "dashboard.review.emptyFoot": "The review queue is empty.",
  "dashboard.review.rowMeta": "{position} · updated {updated}",
  "dashboard.review.openQueue": "Open queue",

  "dashboard.processing.title": "Analyzing",
  "dashboard.processing.meta": {
    one: "{count} candidate · updated by stage",
    other: "{count} candidates · updated by stage",
  },
  "dashboard.processing.viewProgress": "View progress",
  "dashboard.processing.emptyTitle": "Nothing is being analyzed",
  "dashboard.processing.emptyDetail": "Upload a new CV to start an analysis.",
  "dashboard.processing.note":
    "Progress is shown by stage, not as an estimated percentage.",
  "dashboard.stage.0": "Reading CV.pdf",
  "dashboard.stage.1": "Extracting CV content",
  "dashboard.stage.2": "Matching JD criteria",
  "dashboard.stage.3": "Analyzing repository",
  "dashboard.stage.4": "Generating interview questions",
  "dashboard.stage.5": "Generating report",
  "dashboard.stage.running": "Running",

  "dashboard.recent.title": "Recent candidates",
  "dashboard.recent.meta": {
    one: "{count} recent candidate",
    other: "{count} recent candidates",
  },
  "dashboard.recent.colCandidate": "Candidate",
  "dashboard.recent.colPosition": "Position",
  "dashboard.recent.colEvidence": "Evidence",
  "dashboard.recent.colStatus": "Status",
  "dashboard.recent.colUpdated": "Updated",
  "dashboard.recent.emptyTitle": "No completed candidates yet",
  "dashboard.recent.emptyDetail":
    "Reviewed and completed candidates show up here.",

  "dashboard.positions.title": "Candidates by position",
  "dashboard.positions.meta": {
    one: "Total {count} candidate",
    other: "Total {count} candidates",
  },
  "dashboard.positions.link": "Positions",
  "dashboard.positions.more": {
    one: "+{count} candidate in {positions} other position",
    other: "+{count} candidates in {positions} other positions",
  },
  "dashboard.positions.emptyTitle": "No positions yet",
  "dashboard.positions.emptyDetail":
    "Create a position under Positions to attach candidates and criteria.",

  "dashboard.note.title": "Needs attention.",
  "dashboard.note.body": {
    one: "{count} candidate has been waiting for review for over 24 hours; open {name} first so they aren't left waiting.",
    other:
      "{count} candidates have been waiting for review for over 24 hours; open {name} first so they aren't left waiting.",
  },
};

export const dashboardMessages = { vi, en };
