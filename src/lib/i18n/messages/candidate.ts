import type { Message } from "../types";

const vi = {
  "candidate.notFoundTitle": "Không tìm thấy hồ sơ",
  "candidate.notFoundDetail":
    "Hồ sơ có thể đã bị lưu trữ hoặc đường dẫn không đúng.",
  "candidate.backLink": "Danh sách ứng viên",
  "candidate.backToList": "Về danh sách ứng viên",

  "candidate.sub":
    "{role} · {years} năm kinh nghiệm · {location} · {email}",
  "candidate.exportReport": "Xuất báo cáo",
  "candidate.downloadCv": "Tải CV gốc",
  "candidate.downloadCvError": "Không tải được CV gốc. Vui lòng thử lại.",
  "candidate.toInterview": "Chuyển sang phỏng vấn",
  "candidate.source": "Nguồn: {source}",
  "candidate.reviewerMeta": "Người review {reviewer} · cập nhật {updated}",

  "candidate.tabOverview": "Tổng quan",
  "candidate.tabEvidence": "Bằng chứng",
  "candidate.tabRepository": "Repository",
  "candidate.tabQuestions": "Câu hỏi",
  "candidate.tabHistory": "Lịch sử",
  "candidate.tabsAria": "Các phần của hồ sơ",
  "candidate.tabsMeta": "Báo cáo v3 · {time}",

  "candidate.failedTitle": "Repository chưa truy cập được",
  "candidate.failedBody":
    "Báo cáo mới dựa trên CV. Cấp lại quyền repository để phân tích mã nguồn và tạo bằng chứng đầy đủ.",
  "candidate.reanalyze": "Phân tích lại",
  "candidate.processingTitle": "Đang phân tích hồ sơ",
  "candidate.processingBody":
    "Bằng chứng bên dưới là kết quả tạm thời và sẽ được cập nhật khi hoàn tất.",

  "candidate.summaryTitle": "Tóm tắt của CodeCV",
  "candidate.strengthsTitle": "Điểm mạnh có bằng chứng",
  "candidate.verifyTitle": "Cần xác minh",

  "candidate.evidenceTableTitle": "Bảng bằng chứng",
  "candidate.evidenceTableMeta": "{total} tiêu chí · {missing} cần xác minh",
  "candidate.criterionColLabel": "Tiêu chí & nguồn",
  "candidate.criterionColState": "Trạng thái",
  "candidate.criterionColEvidence": "Bằng chứng",
  "candidate.evidenceFootNote":
    "Mỗi tiêu chí chỉ được coi là đã xác minh khi có nguồn cụ thể từ CV, repository hoặc phỏng vấn.",
  "candidate.viewRepoFindings": "Xem phát hiện repository",

  "candidate.repoFindingsTitle": "Phát hiện từ repository",
  "candidate.repoFindingsMeta": "{repo} · {commit} · {count} phát hiện",
  "candidate.repoNotConnected": "Chưa kết nối repository",
  "candidate.openAnalysis": "Mở phân tích",
  "candidate.severityLabel": "Mức {level}",
  "candidate.openFindingAria": "Mở phát hiện {title}",
  "candidate.repoEmptyTitle": "Chưa có phát hiện repository",
  "candidate.repoEmptyDetail":
    "Kết nối repository công khai để đối chiếu code với tiêu chí tuyển dụng.",
  "candidate.connectRepo": "Kết nối repository",
  "candidate.moreFindings":
    "Còn {count} phát hiện khác trong phân tích đầy đủ.",

  "candidate.questionsTitle": "Câu hỏi phỏng vấn",
  "candidate.questionsMeta": "{count} câu · bám theo bằng chứng",
  "candidate.openInterview": "Mở Interview Studio",
  "candidate.moreQuestions":
    "Còn {count} câu hỏi và hướng dẫn đáp án trong Interview Studio.",
  "candidate.allQuestionsShown": "Toàn bộ câu hỏi đã hiển thị.",

  "candidate.historyTitle": "Lịch sử hồ sơ",
  "candidate.historyMeta": "{count} sự kiện",

  "candidate.infoTitle": "Thông tin hồ sơ",
  "candidate.infoPosition": "Vị trí",
  "candidate.infoExperience": "Kinh nghiệm",
  "candidate.infoLocation": "Địa điểm",
  "candidate.infoSource": "Nguồn",
  "candidate.infoReviewer": "Người review",
  "candidate.infoCreated": "Ngày tạo",
  "candidate.infoContact": "Liên hệ",
  "candidate.infoYears": "{years} năm",
  "candidate.unassigned": "Chưa chỉ định",

  "candidate.skillsTitle": "Kỹ năng & độ tin cậy",
  "candidate.skillsMeta": "{count} kỹ năng",
  "candidate.skillsFootNote":
    "{count} tiêu chí chưa đủ dữ liệu; không suy đoán thay bằng chứng.",

  "candidate.noteTitle": "Ghi chú reviewer",
  "candidate.notePlaceholder":
    "Ghi lại điều cần kiểm tra hoặc ấn tượng ban đầu…",
  "candidate.noteAria": "Ghi chú reviewer",
  "candidate.saving": "Đang lưu…",
  "candidate.saveNote": "Lưu ghi chú",
  "candidate.noteSaved": "Đã lưu trong workspace",
  "candidate.notePrivate": "Chỉ hiển thị với người review.",

  "candidate.mdTitle": "Báo cáo ứng viên",
  "candidate.mdSummary": "Tóm tắt",
  "candidate.mdEvidence":
    "Bảng bằng chứng ({covered}/{total} tiêu chí có bằng chứng)",
  "candidate.mdEvidenceCount": "{count} bằng chứng",
  "candidate.mdStrengths": "Điểm mạnh",
  "candidate.mdVerify": "Cần xác minh",
  "candidate.mdNotes": "Ghi chú của reviewer",
  "candidate.mdNoNote": "Chưa có ghi chú.",
} as const;

const en: Record<keyof typeof vi, Message> = {
  "candidate.notFoundTitle": "Candidate not found",
  "candidate.notFoundDetail":
    "The profile may be archived or the link is incorrect.",
  "candidate.backLink": "Candidates",
  "candidate.backToList": "Back to candidates",

  "candidate.sub":
    "{role} · {years} years of experience · {location} · {email}",
  "candidate.exportReport": "Export report",
  "candidate.downloadCv": "Download original CV",
  "candidate.downloadCvError": "Couldn't download the original CV. Please try again.",
  "candidate.toInterview": "Move to interview",
  "candidate.source": "Source: {source}",
  "candidate.reviewerMeta": "Reviewer {reviewer} · updated {updated}",

  "candidate.tabOverview": "Overview",
  "candidate.tabEvidence": "Evidence",
  "candidate.tabRepository": "Repository",
  "candidate.tabQuestions": "Questions",
  "candidate.tabHistory": "History",
  "candidate.tabsAria": "Profile sections",
  "candidate.tabsMeta": "Report v3 · {time}",

  "candidate.failedTitle": "Repository unavailable",
  "candidate.failedBody":
    "This report is based on the CV. Restore repository access to analyze the code and produce complete evidence.",
  "candidate.reanalyze": "Analyze again",
  "candidate.processingTitle": "Analyzing profile",
  "candidate.processingBody":
    "The evidence below is provisional and will update when the analysis completes.",

  "candidate.summaryTitle": "CodeCV summary",
  "candidate.strengthsTitle": "Strengths with evidence",
  "candidate.verifyTitle": "To verify",

  "candidate.evidenceTableTitle": "Evidence table",
  "candidate.evidenceTableMeta": "{total} criteria · {missing} to verify",
  "candidate.criterionColLabel": "Criterion & source",
  "candidate.criterionColState": "Status",
  "candidate.criterionColEvidence": "Evidence",
  "candidate.evidenceFootNote":
    "A criterion counts as verified only when it has a specific source from the CV, repository, or interview.",
  "candidate.viewRepoFindings": "View repository findings",

  "candidate.repoFindingsTitle": "Repository findings",
  "candidate.repoFindingsMeta": {
    one: "{repo} · {commit} · {count} finding",
    other: "{repo} · {commit} · {count} findings",
  },
  "candidate.repoNotConnected": "No repository connected",
  "candidate.openAnalysis": "Open analysis",
  "candidate.severityLabel": "Severity: {level}",
  "candidate.openFindingAria": "Open finding {title}",
  "candidate.repoEmptyTitle": "No repository findings yet",
  "candidate.repoEmptyDetail":
    "Connect a public repository to compare the code against hiring criteria.",
  "candidate.connectRepo": "Connect repository",
  "candidate.moreFindings": {
    one: "{count} more finding in the full analysis.",
    other: "{count} more findings in the full analysis.",
  },

  "candidate.questionsTitle": "Interview questions",
  "candidate.questionsMeta": {
    one: "{count} question · evidence-based",
    other: "{count} questions · evidence-based",
  },
  "candidate.openInterview": "Open Interview Studio",
  "candidate.moreQuestions": {
    one: "{count} more question and answer guide in Interview Studio.",
    other: "{count} more questions and answer guides in Interview Studio.",
  },
  "candidate.allQuestionsShown": "All questions are shown.",

  "candidate.historyTitle": "Profile history",
  "candidate.historyMeta": {
    one: "{count} event",
    other: "{count} events",
  },

  "candidate.infoTitle": "Profile details",
  "candidate.infoPosition": "Position",
  "candidate.infoExperience": "Experience",
  "candidate.infoLocation": "Location",
  "candidate.infoSource": "Source",
  "candidate.infoReviewer": "Reviewer",
  "candidate.infoCreated": "Created",
  "candidate.infoContact": "Contact",
  "candidate.infoYears": "{years} years",
  "candidate.unassigned": "Unassigned",

  "candidate.skillsTitle": "Skills & confidence",
  "candidate.skillsMeta": {
    one: "{count} skill",
    other: "{count} skills",
  },
  "candidate.skillsFootNote": {
    one: "{count} criterion without enough data; we don't guess in place of evidence.",
    other: "{count} criteria without enough data; we don't guess in place of evidence.",
  },

  "candidate.noteTitle": "Reviewer notes",
  "candidate.notePlaceholder": "Note what to check or first impressions…",
  "candidate.noteAria": "Reviewer notes",
  "candidate.saving": "Saving…",
  "candidate.saveNote": "Save note",
  "candidate.noteSaved": "Saved to the workspace",
  "candidate.notePrivate": "Visible to reviewers only.",

  "candidate.mdTitle": "Candidate report",
  "candidate.mdSummary": "Summary",
  "candidate.mdEvidence":
    "Evidence table ({covered}/{total} criteria with evidence)",
  "candidate.mdEvidenceCount": {
    one: "{count} evidence item",
    other: "{count} evidence items",
  },
  "candidate.mdStrengths": "Strengths",
  "candidate.mdVerify": "To verify",
  "candidate.mdNotes": "Reviewer notes",
  "candidate.mdNoNote": "No notes yet.",
};

export const candidateMessages = { vi, en };
