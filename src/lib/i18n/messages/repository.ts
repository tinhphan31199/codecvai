import type { Message } from "../types";

const vi = {
  "repository.pickerSub":
    "Chọn một ứng viên để xem cấu trúc mã nguồn và các phát hiện của họ.",
  "repository.pickerLoading": "Đang tải danh sách ứng viên…",
  "repository.connectedTitle": "Ứng viên đã kết nối repository",
  "repository.profilesCount": "{count} hồ sơ",
  "repository.unavailableNote":
    "{count} hồ sơ chưa kết nối repository — chỉ liệt kê ứng viên đã kết nối để phân tích.",
  "repository.emptyTitle": "Chưa có ứng viên nào kết nối repository",
  "repository.emptyDetail":
    "Tải CV lên và kết nối repository GitHub để bắt đầu phân tích mã nguồn.",
  "repository.uploadCv": "Tải CV lên",

  "repository.notFound": "Không tìm thấy hồ sơ",
  "repository.notFoundDetail":
    "Hồ sơ có thể đã bị lưu trữ hoặc đường dẫn không đúng.",
  "repository.backToCandidates": "Về danh sách ứng viên",
  "repository.inaccessibleTitle": "Repository chưa truy cập được",
  "repository.inaccessibleBody":
    "Repository riêng tư hoặc token đã hết hạn. Cấp lại quyền để đọc commit, cấu trúc và kiểm thử.",
  "repository.regrant": "Cấp lại quyền",
  "repository.analyzedAt": "phân tích lúc {date}",
  "repository.openProfile": "Mở hồ sơ",
  "repository.useInInterview": "Dùng trong phỏng vấn",

  "repository.savedTitle": "Repository của ứng viên",
  "repository.savedMeta":
    "{total} repo · {analyzed} đã đọc · {pending} đang chờ",
  "repository.savedPendingNote":
    "Worker đang đọc lần lượt từng repo ở luồng nền để tránh giới hạn GitHub API; danh sách tự cập nhật.",
  "repository.repoStatusAnalyzed": "Đã đọc",
  "repository.repoStatusPending": "Đang chờ",
  "repository.repoStatusAnalyzing": "Đang phân tích",
  "repository.repoStatusUnavailable": "Không đọc được",
  "repository.repoStatusSkipped": "Bỏ qua",

  "repository.summaryAria": "Tổng quan repository",
  "repository.branchMeta": "{branch} · {commits} commit · {files} tệp",
  "repository.language": "Ngôn ngữ",
  "repository.tests": "Kiểm thử",
  "repository.testsValue": "12 test · 68%",
  "repository.findings": "Phát hiện",
  "repository.findingsSummary": "{total} · {needed} cần xem",
  "repository.status": "Trạng thái",
  "repository.connected": "Đã kết nối",

  "repository.tree": "Cây thư mục",
  "repository.branchLabel": "nhánh {branch}",
  "repository.viewerAria": "Kiến trúc và mã nguồn",
  "repository.viewModeAria": "Chế độ xem",
  "repository.archTab": "Kiến trúc",
  "repository.codeTab": "Mã nguồn",
  "repository.clearLayer": "Bỏ lọc lớp {layer}",
  "repository.archIntro":
    "Chỉ hiển thị thành phần có bằng chứng trong code. Chọn một lớp để lọc phát hiện ở cột bên phải.",
  "repository.layerEvidence": "{count} bằng chứng",
  "repository.archFootnote":
    "{count} phát hiện gắn với entrypoint, handler, aggregate và adapter đã đọc.",
  "repository.line": "dòng {line}",
  "repository.copyCode": "Sao chép đoạn mã",
  "repository.codeAria": "Đoạn mã liên quan",
  "repository.severityAria": "Mức {level}",

  "repository.whyNotable": "Vì sao đáng chú ý",
  "repository.howToVerify": "Cách xác minh",
  "repository.confirmedNote":
    "Đã xác nhận, dùng được làm bằng chứng trong báo cáo.",
  "repository.unconfirm": "Bỏ xác nhận",
  "repository.dismissedNote": "Đã bỏ qua phát hiện này.",
  "repository.undo": "Hoàn tác",
  "repository.confirmFinding": "Xác nhận phát hiện",
  "repository.dismiss": "Bỏ qua",
  "repository.confirmHint": "Chỉ xác nhận sau khi đã chạy bước kiểm chứng.",
  "repository.noFindingInFile": "Không có phát hiện trong {file}",
  "repository.thisFile": "tệp này",
  "repository.noFindingInFileDetail":
    "AI chưa có bằng chứng trong tệp này. Chọn tệp có đánh dấu trong cây thư mục hoặc một phát hiện ở cột bên phải.",

  "repository.findingsAria": "Danh sách phát hiện",
  "repository.filteredByLayer": "{visible}/{total} · lớp {layer}",
  "repository.filterAria": "Lọc phát hiện",
  "repository.filterAll": "Tất cả",
  "repository.filterNeeds": "Cần xem",
  "repository.severityState": "{severity} · {state}",
  "repository.railEmpty": "Không có phát hiện ở trạng thái này.",
  "repository.railFootnote":
    "Phát hiện là suy luận có nguồn, không phải kết luận tuyển dụng.",
} as const;

const en: Record<keyof typeof vi, Message> = {
  "repository.pickerSub":
    "Pick a candidate to review their source structure and findings.",
  "repository.pickerLoading": "Loading candidates…",
  "repository.connectedTitle": "Candidates with a connected repository",
  "repository.profilesCount": {
    one: "{count} profile",
    other: "{count} profiles",
  },
  "repository.unavailableNote": {
    one: "{count} profile has no connected repository — only connected candidates are listed for analysis.",
    other:
      "{count} profiles have no connected repository — only connected candidates are listed for analysis.",
  },
  "repository.emptyTitle": "No candidates have connected a repository yet",
  "repository.emptyDetail":
    "Upload a CV and connect a GitHub repository to start analyzing source code.",
  "repository.uploadCv": "Upload CV",

  "repository.notFound": "Profile not found",
  "repository.notFoundDetail":
    "The profile may be archived or the link is incorrect.",
  "repository.backToCandidates": "Back to candidates",
  "repository.inaccessibleTitle": "Repository unavailable",
  "repository.inaccessibleBody":
    "The repository is private or the token expired. Re-authorize to read commits, structure and tests.",
  "repository.regrant": "Re-authorize",
  "repository.analyzedAt": "analyzed {date}",
  "repository.openProfile": "Open profile",
  "repository.useInInterview": "Use in interview",

  "repository.savedTitle": "Candidate repositories",
  "repository.savedMeta":
    "{total} repos · {analyzed} read · {pending} waiting",
  "repository.savedPendingNote":
    "The worker reads one repository at a time in the background to stay under GitHub's rate limit; this list refreshes automatically.",
  "repository.repoStatusAnalyzed": "Read",
  "repository.repoStatusPending": "Waiting",
  "repository.repoStatusAnalyzing": "Analyzing",
  "repository.repoStatusUnavailable": "Unreadable",
  "repository.repoStatusSkipped": "Skipped",

  "repository.summaryAria": "Repository overview",
  "repository.branchMeta": "{branch} · {commits} commits · {files} files",
  "repository.language": "Language",
  "repository.tests": "Tests",
  "repository.testsValue": "12 tests · 68%",
  "repository.findings": "Findings",
  "repository.findingsSummary": "{total} · {needed} to review",
  "repository.status": "Status",
  "repository.connected": "Connected",

  "repository.tree": "File tree",
  "repository.branchLabel": "{branch} branch",
  "repository.viewerAria": "Architecture and source",
  "repository.viewModeAria": "View mode",
  "repository.archTab": "Architecture",
  "repository.codeTab": "Source",
  "repository.clearLayer": "Clear layer filter {layer}",
  "repository.archIntro":
    "Only components with evidence in the code are shown. Select a layer to filter findings in the right column.",
  "repository.layerEvidence": {
    one: "{count} evidence item",
    other: "{count} evidence items",
  },
  "repository.archFootnote": {
    one: "{count} finding tied to the entrypoints, handlers, aggregates and adapters read.",
    other:
      "{count} findings tied to the entrypoints, handlers, aggregates and adapters read.",
  },
  "repository.line": "line {line}",
  "repository.copyCode": "Copy code snippet",
  "repository.codeAria": "Relevant code snippet",
  "repository.severityAria": "Severity: {level}",

  "repository.whyNotable": "Why it stands out",
  "repository.howToVerify": "How to verify",
  "repository.confirmedNote":
    "Confirmed and usable as evidence in the report.",
  "repository.unconfirm": "Unconfirm",
  "repository.dismissedNote": "This finding was dismissed.",
  "repository.undo": "Undo",
  "repository.confirmFinding": "Confirm finding",
  "repository.dismiss": "Dismiss",
  "repository.confirmHint": "Only confirm after running the verification step.",
  "repository.noFindingInFile": "No findings in {file}",
  "repository.thisFile": "this file",
  "repository.noFindingInFileDetail":
    "The AI has no evidence in this file. Pick a marked file in the tree or a finding in the right column.",

  "repository.findingsAria": "Findings list",
  "repository.filteredByLayer": "{visible}/{total} · layer {layer}",
  "repository.filterAria": "Filter findings",
  "repository.filterAll": "All",
  "repository.filterNeeds": "Needs review",
  "repository.severityState": "{severity} · {state}",
  "repository.railEmpty": "No findings in this state.",
  "repository.railFootnote":
    "Findings are sourced inferences, not hiring conclusions.",
};

export const repositoryMessages = { vi, en };
