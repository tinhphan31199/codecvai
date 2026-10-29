import type { Message } from "../types";

const vi = {
  "interview.sub": "{name} · {position} · {count} câu hỏi",
  "interview.openProfile": "Mở hồ sơ",
  "interview.export": "Xuất phiếu phỏng vấn",

  "interview.select.sub": "Chọn ứng viên để bắt đầu phỏng vấn.",
  "interview.select.title": "Danh sách ứng viên",
  "interview.select.meta": "{count} hồ sơ",
  "interview.select.action": "Bắt đầu phỏng vấn {name}",
  "interview.select.empty.title": "Chưa có ứng viên",
  "interview.select.empty.detail":
    "Tải CV lên để tạo hồ sơ và bắt đầu phỏng vấn.",
  "interview.select.empty.action": "Tải CV lên",
  "interview.select.searchPlaceholder": "Tìm theo tên, email, vị trí…",
  "interview.select.searchAria": "Tìm ứng viên",
  "interview.select.clearSearchAria": "Xóa tìm kiếm",
  "interview.select.filterStatusAria": "Lọc theo trạng thái",
  "interview.select.filterPositionAria": "Lọc theo vị trí",
  "interview.select.statusAll": "Tất cả",
  "interview.select.allPositions": "Tất cả vị trí",
  "interview.select.clearFilters": "Xóa bộ lọc",
  "interview.select.resultCount": "{count} kết quả",
  "interview.select.pageInfo": "Hiển thị {from}–{to} trên {total} hồ sơ",
  "interview.select.prev": "Trước",
  "interview.select.next": "Sau",
  "interview.select.noMatch.title": "Không có hồ sơ khớp bộ lọc",
  "interview.select.noMatch.detail":
    "Thử bỏ bớt bộ lọc hoặc tìm bằng từ khoá khác.",

  "interview.notFound.title": "Không tìm thấy hồ sơ",
  "interview.notFound.detail":
    "Hồ sơ có thể đã bị lưu trữ hoặc đường dẫn không đúng.",
  "interview.notFound.action": "Về danh sách ứng viên",

  "interview.person.meta": "{role} · {years} năm · {location}",
  "interview.updated": "Cập nhật {time}",
  "interview.askedProgress": "Đã hỏi {asked}/{total}",
  "interview.ratedProgress": "Đã chấm {rated}/{total} tiêu chí",

  "interview.category.architecture": "Kiến trúc",
  "interview.category.database": "Cơ sở dữ liệu",
  "interview.category.messaging": "Messaging",
  "interview.category.security": "Bảo mật",
  "interview.category.testing": "Kiểm thử",

  "interview.questions.aria": "Danh sách câu hỏi",
  "interview.questions.title": "Câu hỏi theo chủ đề",
  "interview.questions.meta": "{count} câu · {groups} nhóm",
  "interview.questions.askedMeta": "{difficulty} · đã hỏi",

  "interview.answer.aria": "Chi tiết câu hỏi",
  "interview.answer.index": "Câu {current}/{total}",
  "interview.answer.badge": "Đã hỏi",
  "interview.answer.markAsked": "Đánh dấu đã hỏi",
  "interview.answer.tabsAria": "Nội dung câu trả lời",

  "interview.tab.hints": "Gợi ý",
  "interview.tab.sample": "Câu trả lời mẫu",
  "interview.tab.checks": "Điểm cần kiểm tra",

  "interview.hint.1":
    "Bắt đầu bằng một tình huống thật trong repository, không trả lời lý thuyết.",
  "interview.hint.2":
    "Đào vào quyết định: vì sao chọn cách này, đánh đổi điều gì.",
  "interview.hint.3":
    "Hỏi tiếp nếu câu trả lời dừng ở khái niệm hoặc không có ví dụ.",
  "interview.followUps": "Câu hỏi nối tiếp",

  "interview.sample.note":
    "Câu trả lời mẫu là hướng dẫn, không phải đáp án bắt buộc.",

  "interview.check.1": "Nêu bối cảnh và ràng buộc cụ thể từ repository.",
  "interview.check.2": "Chỉ ra trade-off và phương án thay thế đã cân nhắc.",
  "interview.check.3":
    "Mô tả cách kiểm chứng hoặc đo kết quả sau khi làm.",

  "interview.note.label": "Ghi chú cho câu hỏi này",
  "interview.note.placeholder":
    "Câu trả lời nổi bật, điểm cần đào sâu, bằng chứng bổ sung…",
  "interview.note.save": "Lưu ghi chú",
  "interview.note.saved": "Đã lưu trong phiên",
  "interview.note.hint": "Ghi chú chỉ hiển thị với người phỏng vấn.",

  "interview.empty.title": "Chưa có câu hỏi",
  "interview.empty.detail":
    "Tạo báo cáo ứng viên trước để sinh câu hỏi phỏng vấn.",

  "interview.rubric.title": "Rubric phỏng vấn",
  "interview.rubric.meta": "{count} tiêu chí · thang 0–4",
  "interview.rubric.groupAria": "Chấm điểm {criterion}",
  "interview.rubric.btnAria": "{criterion}: {score} trên 4",
  "interview.rubric.note":
    "Điểm do người phỏng vấn chấm; không dùng điểm tổng tự động.",

  "interview.session.title": "Phiên phỏng vấn",
  "interview.session.interviewer": "Người phỏng vấn",
  "interview.session.updated": "Cập nhật",
  "interview.session.level": "Cấp bậc",
  "interview.session.source": "Nguồn",
  "interview.session.repository": "Xem repository đã phân tích",

  "interview.export.docTitle": "# Phiếu phỏng vấn — CodeCV AI",
  "interview.export.interviewer":
    "Người phỏng vấn: {reviewer} · Cập nhật: {updated}",
  "interview.export.rubric": "## Rubric (0–4)",
  "interview.export.rating": "- {label}: {rating}",
  "interview.export.unrated": "chưa chấm",
  "interview.export.asked": "## Câu hỏi đã hỏi",
  "interview.export.notes": "## Ghi chú",
  "interview.export.noNotes": "Chưa có ghi chú.",
  "interview.export.noteLine": "- Câu {index}: {note}",
} as const;

const en: Record<keyof typeof vi, Message> = {
  "interview.sub": {
    one: "{name} · {position} · {count} question",
    other: "{name} · {position} · {count} questions",
  },
  "interview.openProfile": "Open profile",
  "interview.export": "Export interview sheet",

  "interview.select.sub": "Pick a candidate to start the interview.",
  "interview.select.title": "Candidates",
  "interview.select.meta": {
    one: "{count} profile",
    other: "{count} profiles",
  },
  "interview.select.action": "Start interview with {name}",
  "interview.select.empty.title": "No candidates yet",
  "interview.select.empty.detail":
    "Upload a CV to create a profile and start interviewing.",
  "interview.select.empty.action": "Upload CV",
  "interview.select.searchPlaceholder": "Search by name, email, position…",
  "interview.select.searchAria": "Search candidates",
  "interview.select.clearSearchAria": "Clear search",
  "interview.select.filterStatusAria": "Filter by status",
  "interview.select.filterPositionAria": "Filter by position",
  "interview.select.statusAll": "All",
  "interview.select.allPositions": "All positions",
  "interview.select.clearFilters": "Clear filters",
  "interview.select.resultCount": {
    one: "{count} result",
    other: "{count} results",
  },
  "interview.select.pageInfo": "Showing {from}–{to} of {total} profiles",
  "interview.select.prev": "Previous",
  "interview.select.next": "Next",
  "interview.select.noMatch.title": "No profiles match the filters",
  "interview.select.noMatch.detail":
    "Try removing a filter or using another keyword.",

  "interview.notFound.title": "Profile not found",
  "interview.notFound.detail":
    "This profile may have been archived or the link is incorrect.",
  "interview.notFound.action": "Back to candidates",

  "interview.person.meta": "{role} · {years} yrs · {location}",
  "interview.updated": "Updated {time}",
  "interview.askedProgress": "Asked {asked}/{total}",
  "interview.ratedProgress": "Scored {rated}/{total} criteria",

  "interview.category.architecture": "Architecture",
  "interview.category.database": "Database",
  "interview.category.messaging": "Messaging",
  "interview.category.security": "Security",
  "interview.category.testing": "Testing",

  "interview.questions.aria": "Question list",
  "interview.questions.title": "Questions by topic",
  "interview.questions.meta": {
    one: "{count} question · {groups} topics",
    other: "{count} questions · {groups} topics",
  },
  "interview.questions.askedMeta": "{difficulty} · asked",

  "interview.answer.aria": "Question detail",
  "interview.answer.index": "Question {current}/{total}",
  "interview.answer.badge": "Asked",
  "interview.answer.markAsked": "Mark as asked",
  "interview.answer.tabsAria": "Answer content",

  "interview.tab.hints": "Hints",
  "interview.tab.sample": "Sample answer",
  "interview.tab.checks": "Checkpoints",

  "interview.hint.1":
    "Start from a real situation in the repository; don't answer in theory.",
  "interview.hint.2":
    "Dig into the decision: why this approach, what was traded off.",
  "interview.hint.3":
    "Keep probing if the answer stays conceptual or lacks examples.",
  "interview.followUps": "Follow-up questions",

  "interview.sample.note":
    "The sample answer is a guide, not a required answer.",

  "interview.check.1":
    "States the context and the specific constraints from the repository.",
  "interview.check.2":
    "Names the trade-offs and the alternatives that were considered.",
  "interview.check.3":
    "Describes how the result was verified or measured afterwards.",

  "interview.note.label": "Notes for this question",
  "interview.note.placeholder":
    "Highlights, areas to dig into, extra evidence…",
  "interview.note.save": "Save note",
  "interview.note.saved": "Saved for this session",
  "interview.note.hint": "Notes are only visible to the interviewer.",

  "interview.empty.title": "No questions yet",
  "interview.empty.detail":
    "Generate a candidate report first to create interview questions.",

  "interview.rubric.title": "Interview rubric",
  "interview.rubric.meta": {
    one: "{count} criterion · 0–4 scale",
    other: "{count} criteria · 0–4 scale",
  },
  "interview.rubric.groupAria": "Score {criterion}",
  "interview.rubric.btnAria": "{criterion}: {score} out of 4",
  "interview.rubric.note":
    "Scores are set by the interviewer; no automatic total is used.",

  "interview.session.title": "Interview session",
  "interview.session.interviewer": "Interviewer",
  "interview.session.updated": "Updated",
  "interview.session.level": "Level",
  "interview.session.source": "Source",
  "interview.session.repository": "View analyzed repository",

  "interview.export.docTitle": "# Interview sheet — CodeCV AI",
  "interview.export.interviewer":
    "Interviewer: {reviewer} · Updated: {updated}",
  "interview.export.rubric": "## Rubric (0–4)",
  "interview.export.rating": "- {label}: {rating}",
  "interview.export.unrated": "not scored",
  "interview.export.asked": "## Questions asked",
  "interview.export.notes": "## Notes",
  "interview.export.noNotes": "No notes yet.",
  "interview.export.noteLine": "- Question {index}: {note}",
};

export const interviewMessages = { vi, en };
