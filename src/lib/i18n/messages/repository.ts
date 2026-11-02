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
  "repository.repoStatusAnalyzed": "Đã đọc",
  "repository.repoStatusPending": "Đang chờ",
  "repository.repoStatusAnalyzing": "Đang phân tích",
  "repository.repoStatusUnavailable": "Không đọc được",
  "repository.repoStatusSkipped": "Bỏ qua",
  "repository.pickerLabel": "Repository đang xem",
  "repository.pickerHint":
    "Cây thư mục, tổng hợp và chi tiết bên dưới đổi theo repo đã chọn.",

  "repository.summaryAria": "Tổng quan repository",
  "repository.filesCount": "{count} tệp",
  "repository.language": "Ngôn ngữ",
  "repository.files": "Tệp đã đọc",
  "repository.findings": "Phát hiện",
  "repository.findingsSummary": "{total} · {needed} cần xem",
  "repository.status": "Trạng thái",
  "repository.connected": "Đã kết nối",

  "repository.tree": "Cây thư mục",
  "repository.treeResizeAria":
    "Kéo hoặc dùng phím mũi tên để đổi độ rộng cây thư mục",
  "repository.branchLabel": "nhánh {branch}",
  "repository.treeEmpty": "Chưa có cây thư mục cho repo này.",
  "repository.treePending":
    "Đang đọc repo ở luồng nền — cây thư mục sẽ hiện khi xong.",
  "repository.treeTruncated":
    "Còn {count} tệp ngoài cây thư mục do giới hạn hiển thị.",
  "repository.viewerAria": "Tổng quan, kiến trúc và mã nguồn",
  "repository.viewModeAria": "Chế độ xem",
  "repository.overviewTab": "Tổng quan",
  "repository.archTab": "Kiến trúc",
  "repository.codeTab": "Mã nguồn",
  "repository.retry": "Thử lại",
  "repository.retrying": "Đang thử lại…",
  "repository.retryAria": "Thử lại đọc {label}",
  "repository.reread": "Đọc lại",
  "repository.rereadAria": "Đọc lại repository {label}",
  "repository.stars": "Sao",
  "repository.forks": "Fork",
  "repository.watchers": "Theo dõi",
  "repository.openIssues": "Issue mở",
  "repository.size": "Dung lượng",
  "repository.license": "Giấy phép",
  "repository.created": "Tạo lúc",
  "repository.pushed": "Cập nhật",
  "repository.homepage": "Trang chủ",
  "repository.noDescription": "Repository chưa có mô tả trên GitHub.",
  "repository.codeSummary": "Tổng hợp mã nguồn",
  "repository.codeSummaryAria": "Tổng hợp mã nguồn của repository",
  "repository.codeSummaryMeta": "{files} tệp · {folders} thư mục",
  "repository.summaryFiles": "Tệp",
  "repository.summaryFolders": "Thư mục",
  "repository.summarySize": "Dung lượng mã",
  "repository.summaryTests": "Tệp kiểm thử",
  "repository.summaryModules": "Cấu trúc chính",
  "repository.summaryFileTypes": "Loại tệp",
  "repository.summaryKeyFiles": "Tệp quan trọng",
  "repository.summaryEntrypoints": "Điểm vào",
  "repository.summaryFootnote":
    "Tổng hợp từ cây thư mục và metadata của lần quét, lưu trong DB; không đọc nội dung từng tệp.",
  "repository.flagManifest": "Khai báo phụ thuộc",
  "repository.flagTests": "Có kiểm thử",
  "repository.flagDocker": "Docker",
  "repository.flagCi": "CI",
  "repository.flagDocs": "Tài liệu",
  "repository.flagLicense": "Giấy phép",
  "repository.flagMigrations": "Migration",
  "repository.flagEnv": "Biến môi trường",
  "repository.keyKindManifest": "Khai báo",
  "repository.keyKindContainer": "Container",
  "repository.keyKindCi": "CI",
  "repository.keyKindDocs": "Tài liệu",
  "repository.keyKindLicense": "Giấy phép",
  "repository.keyKindConfig": "Cấu hình",
  "repository.keyKindEntry": "Điểm vào",
  "repository.languages": "Ngôn ngữ",
  "repository.topics": "Chủ đề",
  "repository.commits": "Commit gần đây",
  "repository.readme": "README",
  "repository.readmeTrimmed":
    "README gốc dài {count} ký tự, chỉ hiển thị phần đầu.",
  "repository.detailsMissing":
    "Chưa có dữ liệu chi tiết cho repo này. Đọc lại repository để lấy mô tả, ngôn ngữ, chủ đề và commit.",
  "repository.detailsPending":
    "Worker đang đọc repository ở luồng nền; thông tin chi tiết sẽ hiện khi xong.",
  "repository.noFile": "Chưa có tệp để xem",
  "repository.noFileDetail":
    "Chọn một tệp ở cây thư mục bên trái để xem nội dung đã đọc từ GitHub.",
  "repository.fileLoading": "Đang đọc tệp…",
  "repository.fileRetry": "Đọc lại tệp",
  "repository.fileTruncated": "Cắt bớt",
  "repository.copyFile": "Sao chép nội dung tệp",
  "repository.fileAria": "Nội dung tệp",
  "repository.fileFootnote":
    "Nội dung đọc từ GitHub blob của lần quét gần nhất.",
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
  "repository.railClean":
    "AI đã đọc mã nguồn và không thấy vấn đề đáng chú ý.",
  "repository.findingsAnalyzingMeta": "AI đang đọc mã nguồn",
  "repository.findingsPendingMeta": "Đang chờ AI phân tích",
  "repository.findingsFailedMeta": "Phân tích thất bại",
  "repository.findingsNotRunMeta": "Chưa phân tích",
  "repository.findingsAnalyzingTitle": "AI đang đọc tệp nguồn",
  "repository.findingsPendingTitle": "Đang xếp hàng phân tích",
  "repository.findingsRunningDetail":
    "Phân tích chạy ở luồng nền; danh sách tự cập nhật khi xong.",
  "repository.findingsFailedTitle": "Không phân tích được mã nguồn",
  "repository.findingsFailedDetail":
    "Lần phân tích trước chưa hoàn tất. Thử lại để AI đọc các tệp nguồn đã chọn.",
  "repository.findingsNotRunTitle": "Chưa có phân tích phát hiện",
  "repository.findingsNotRunDetail":
    "AI chưa đọc mã nguồn của repo này. Chạy phân tích để có phát hiện có nguồn.",
  "repository.findingsAnalyze": "Phân tích phát hiện",
  "repository.findingsRetry": "Phân tích lại",
  "repository.findingsQueueing": "Đang xếp hàng…",
  "repository.railFootnote":
    "Phát hiện là suy luận có nguồn, không phải kết luận tuyển dụng.",

  "repository.chatTitle": "Hỏi đáp repository",
  "repository.chatMeta": "Hỏi về repo đang chọn · lịch sử được lưu lại",
  "repository.chatAria": "Khung hỏi đáp về repository",
  "repository.chatYou": "Bạn",
  "repository.chatAssistant": "Trợ lý AI",
  "repository.chatEmptyTitle": "Hỏi AI về repository đang chọn",
  "repository.chatEmptyDetail":
    "Câu trả lời dựa trên metadata, tổng hợp, phát hiện đã lưu và một mẫu tệp nguồn đã đọc. Mỗi lượt hỏi đáp được lưu theo repository.",
  "repository.chatSuggestion1": "Kiến trúc và luồng xử lý chính của repo này?",
  "repository.chatSuggestion2": "Phát hiện nào rủi ro bảo mật đáng chú ý?",
  "repository.chatSuggestion3": "Nên hỏi ứng viên gì về repo này?",
  "repository.chatPlaceholder": "Hỏi về kiến trúc, mã nguồn hoặc phát hiện…",
  "repository.chatSend": "Gửi câu hỏi",
  "repository.chatSending": "Đang gửi…",
  "repository.chatThinking": "AI đang đọc repository…",
  "repository.chatLoading": "Đang tải lịch sử hỏi đáp…",
  "repository.chatRetry": "Tải lại lịch sử",
  "repository.chatHint": "Enter để gửi · Shift+Enter để xuống dòng",
  "repository.chatFoot":
    "Câu trả lời do AI tổng hợp từ dữ liệu đã đọc và có thể sai; kiểm tra lại trong mã nguồn.",
  "repository.chatNotReady":
    "Repository chưa có cây thư mục đã đọc. Chạy đọc lại repository trước khi hỏi.",
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
  "repository.repoStatusAnalyzed": "Read",
  "repository.repoStatusPending": "Waiting",
  "repository.repoStatusAnalyzing": "Analyzing",
  "repository.repoStatusUnavailable": "Unreadable",
  "repository.repoStatusSkipped": "Skipped",
  "repository.pickerLabel": "Repository to view",
  "repository.pickerHint":
    "The tree, summary and details below follow the selected repository.",

  "repository.summaryAria": "Repository overview",
  "repository.filesCount": {
    one: "{count} file",
    other: "{count} files",
  },
  "repository.language": "Language",
  "repository.files": "Files read",
  "repository.findings": "Findings",
  "repository.findingsSummary": "{total} · {needed} to review",
  "repository.status": "Status",
  "repository.connected": "Connected",

  "repository.tree": "File tree",
  "repository.treeResizeAria":
    "Drag or use the arrow keys to resize the file tree",
  "repository.branchLabel": "{branch} branch",
  "repository.treeEmpty": "No file tree for this repository yet.",
  "repository.treePending":
    "Reading this repository in the background — the tree will appear when it finishes.",
  "repository.treeTruncated": {
    one: "{count} more file is outside the tree due to the display limit.",
    other: "{count} more files are outside the tree due to the display limit.",
  },
  "repository.viewerAria": "Overview, architecture and source",
  "repository.viewModeAria": "View mode",
  "repository.overviewTab": "Overview",
  "repository.archTab": "Architecture",
  "repository.codeTab": "Source",
  "repository.retry": "Retry",
  "repository.retrying": "Retrying…",
  "repository.retryAria": "Retry reading {label}",
  "repository.reread": "Re-read",
  "repository.rereadAria": "Re-read repository {label}",
  "repository.stars": "Stars",
  "repository.forks": "Forks",
  "repository.watchers": "Watchers",
  "repository.openIssues": "Open issues",
  "repository.size": "Size",
  "repository.license": "License",
  "repository.created": "Created",
  "repository.pushed": "Last push",
  "repository.homepage": "Homepage",
  "repository.noDescription": "This repository has no description on GitHub.",
  "repository.codeSummary": "Code summary",
  "repository.codeSummaryAria": "Code summary of the repository",
  "repository.codeSummaryMeta": "{files} files · {folders} folders",
  "repository.summaryFiles": "Files",
  "repository.summaryFolders": "Folders",
  "repository.summarySize": "Code size",
  "repository.summaryTests": "Test files",
  "repository.summaryModules": "Main structure",
  "repository.summaryFileTypes": "File types",
  "repository.summaryKeyFiles": "Key files",
  "repository.summaryEntrypoints": "Entry points",
  "repository.summaryFootnote":
    "Built from the scanned tree and metadata and stored in the DB; file contents are not read.",
  "repository.flagManifest": "Dependencies",
  "repository.flagTests": "Tests",
  "repository.flagDocker": "Docker",
  "repository.flagCi": "CI",
  "repository.flagDocs": "Docs",
  "repository.flagLicense": "License",
  "repository.flagMigrations": "Migrations",
  "repository.flagEnv": "Environment",
  "repository.keyKindManifest": "Manifest",
  "repository.keyKindContainer": "Container",
  "repository.keyKindCi": "CI",
  "repository.keyKindDocs": "Docs",
  "repository.keyKindLicense": "License",
  "repository.keyKindConfig": "Config",
  "repository.keyKindEntry": "Entry",
  "repository.languages": "Languages",
  "repository.topics": "Topics",
  "repository.commits": "Recent commits",
  "repository.readme": "README",
  "repository.readmeTrimmed": {
    one: "The original README is {count} character long; only the beginning is shown.",
    other:
      "The original README is {count} characters long; only the beginning is shown.",
  },
  "repository.detailsMissing":
    "No detail data for this repository yet. Re-read it to fetch the description, languages, topics and commits.",
  "repository.detailsPending":
    "The worker is reading this repository in the background; details will appear when it finishes.",
  "repository.noFile": "No file to show",
  "repository.noFileDetail":
    "Pick a file in the tree on the left to read its contents from GitHub.",
  "repository.fileLoading": "Reading file…",
  "repository.fileRetry": "Reload file",
  "repository.fileTruncated": "Truncated",
  "repository.copyFile": "Copy file contents",
  "repository.fileAria": "File contents",
  "repository.fileFootnote":
    "Read from the GitHub blob of the latest scan.",
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
  "repository.railClean":
    "The AI read the source and found nothing notable.",
  "repository.findingsAnalyzingMeta": "AI is reading the source",
  "repository.findingsPendingMeta": "Waiting for AI analysis",
  "repository.findingsFailedMeta": "Analysis failed",
  "repository.findingsNotRunMeta": "Not analyzed",
  "repository.findingsAnalyzingTitle": "AI is reading source files",
  "repository.findingsPendingTitle": "Analysis queued",
  "repository.findingsRunningDetail":
    "Analysis runs in the background; this list refreshes when it finishes.",
  "repository.findingsFailedTitle": "Source analysis failed",
  "repository.findingsFailedDetail":
    "The last analysis did not finish. Retry so the AI can read the selected source files.",
  "repository.findingsNotRunTitle": "No findings analysis yet",
  "repository.findingsNotRunDetail":
    "The AI has not read this repository's source. Run the analysis to get sourced findings.",
  "repository.findingsAnalyze": "Analyze findings",
  "repository.findingsRetry": "Analyze again",
  "repository.findingsQueueing": "Queueing…",
  "repository.railFootnote":
    "Findings are sourced inferences, not hiring conclusions.",

  "repository.chatTitle": "Repository Q&A",
  "repository.chatMeta": "Ask about the selected repo · history is saved",
  "repository.chatAria": "Repository Q&A panel",
  "repository.chatYou": "You",
  "repository.chatAssistant": "AI assistant",
  "repository.chatEmptyTitle": "Ask the AI about the selected repository",
  "repository.chatEmptyDetail":
    "Answers use metadata, the code summary, saved findings and a sample of read source files. Every exchange is saved per repository.",
  "repository.chatSuggestion1": "What is this repo's architecture and main flow?",
  "repository.chatSuggestion2": "Which findings look like security risks?",
  "repository.chatSuggestion3": "What should we ask the candidate about this repo?",
  "repository.chatPlaceholder": "Ask about architecture, source or findings…",
  "repository.chatSend": "Send question",
  "repository.chatSending": "Sending…",
  "repository.chatThinking": "The AI is reading the repository…",
  "repository.chatLoading": "Loading Q&A history…",
  "repository.chatRetry": "Reload history",
  "repository.chatHint": "Enter to send · Shift+Enter for a new line",
  "repository.chatFoot":
    "Answers are assembled by the AI from read data and may be wrong; verify in the source.",
  "repository.chatNotReady":
    "This repository has no read file tree yet. Re-read the repository before asking.",
};

export const repositoryMessages = { vi, en };
