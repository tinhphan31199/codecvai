import type { Message } from "../types";

const vi = {
  "upload.loading": "Đang tải vị trí và công đoạn phân tích…",
  "upload.sub":
    "Tải CV, đối chiếu với mô tả công việc và tạo bằng chứng có thể kiểm chứng.",
  "upload.history": "Lịch sử phân tích",
  "upload.errorTitle": "Không thể phân tích CV",

  "upload.uploadCardTitle": "Tải hồ sơ",
  "upload.uploadCardMeta": "PDF, DOCX · tối đa 10 MB",
  "upload.dropTitle": "Kéo thả CV vào đây",
  "upload.dropSub": "hoặc chọn file từ máy · PDF, DOCX · tối đa 10 MB",
  "upload.dropAria": "Chọn hoặc kéo thả file CV",
  "upload.previewPdfAria": "Xem trước PDF",
  "upload.clearFileAria": "Bỏ file đã chọn",
  "upload.levelLabel": "Cấp bậc đánh giá",
  "upload.repoNote":
    "Link GitHub trong CV được đọc qua GitHub API: repo công khai sẽ phân tích mã nguồn, hồ sơ cá nhân sẽ quét toàn bộ repo công khai.",
  "upload.filePolicy":
    "File được lưu trong workspace Product Engineering và chỉ dùng để đánh giá tuyển dụng.",

  "upload.error.type":
    "Chỉ hỗ trợ CV định dạng PDF hoặc DOCX. Chọn tệp khác.",
  "upload.error.empty": "Tệp rỗng. Chọn tệp khác.",
  "upload.error.tooLarge":
    "Tệp vượt quá 10 MB. Nén hoặc xuất lại CV rồi thử lại.",
  "upload.error.server": "Máy chủ trả lời lỗi {status}. Thử lại sau.",
  "upload.error.network":
    "Không kết nối được máy chủ phân tích. Kiểm tra kết nối mạng rồi thử lại.",
  "upload.error.timeout":
    "Phân tích vượt quá 150 giây. Thử lại hoặc dùng Gemini 3.1 Flash Lite.",

  "upload.fileNote.done": "{count} tiêu chí đã đối chiếu",
  "upload.fileNote.donePages": "{pages} trang · {count} tiêu chí đã đối chiếu",
  "upload.fileNote.uploading": "đang tải lên máy chủ",
  "upload.fileNote.analyzing": "đang phân tích bằng Gemini",
  "upload.fileNote.error": "phân tích chưa hoàn tất",
  "upload.fileNote.idle": "sẵn sàng phân tích",

  "upload.configTitle": "Cấu hình phân tích",
  "upload.queuedLead": "Đã phân tích ",
  "upload.queuedTail": ".",
  "upload.viewResult": "Xem kết quả",
  "upload.teamLabel": "Chuyên môn",
  "upload.positionLabel": "Vị trí đối chiếu",
  "upload.languageLabel": "Ngôn ngữ đánh giá",
  "upload.langVi": "Tiếng Việt",
  "upload.langEn": "English",
  "upload.modelLabel": "Model phân tích",
  "upload.noModelOption": "Chưa có model nào đang bật",

  "upload.jdLabel": "Đối chiếu với JD",
  "upload.jdHint": "Chỉ ra tiêu chí đáp ứng và phần còn thiếu.",
  "upload.questionsLabel": "Tạo câu hỏi phỏng vấn",
  "upload.questionsHint":
    "Câu hỏi bám theo bằng chứng, không hỏi chung chung.",

  "upload.stageCount": "{count} công đoạn phân tích",
  "upload.progressUploadTitle": "Tải hồ sơ",
  "upload.progressUploading": "Đang gửi tệp lên máy chủ",
  "upload.progressReceived": "Đã nhận tệp",
  "upload.progressAnalyzeTitle": "Phân tích hồ sơ",
  "upload.progressAnalyzeDetail":
    "Trích xuất nội dung và đối chiếu {count} tiêu chí",
  "upload.progressNote":
    "Không hiển thị phần trăm ước lượng; thời gian phụ thuộc độ dài CV và model.",

  "upload.submit": "Bắt đầu phân tích",
  "upload.submitUploading": "Đang tải CV…",
  "upload.submitAnalyzing": "Đang phân tích…",
  "upload.hintPick": "Chọn một CV để bắt đầu.",
  "upload.hintRunning": "Đang xử lý với {model}. Không đóng tab.",
  "upload.hintNoModel":
    "Bật ít nhất một model ở Cài đặt → AI models để phân tích.",

  "upload.resultTitle": "Kết quả phân tích",
  "upload.resultMeta": "{count} tiêu chí · {model}",
  "upload.viewPdf": "Xem PDF",
  "upload.downloadJson": "Tải JSON",
  "upload.analyzeAnother": "Phân tích CV khác",
  "upload.statusAnalyzed": "Đã phân tích",
  "upload.yearsExperience": "{count} năm kinh nghiệm",
  "upload.roleUnknown": "Chưa nhận diện được vị trí hiện tại",

  "upload.reposLabel": "Repository & GitHub",
  "upload.githubMeta": "Đã đọc {analyzed}/{targets} mục GitHub",
  "upload.githubMetaPublic":
    "Đã đọc {analyzed}/{targets} mục GitHub · {public} repo công khai",
  "upload.repoRead": "Đã đọc",
  "upload.repoSkipped": "Bỏ qua",
  "upload.repoUnread": "Chưa đọc",
  "upload.reposEmpty": "CV không đề cập repository công khai.",

  "upload.evidenceLabel": "Bằng chứng",
  "upload.criteriaTitle": "Đối chiếu tiêu chí",
  "upload.criteriaMust": "Bắt buộc",
  "upload.criteriaNice": "Ưu tiên",
  "upload.strengthsTitle": "Điểm mạnh có bằng chứng",
  "upload.gapsTitle": "Cần xác minh",
  "upload.questionsTitle": "Câu hỏi phỏng vấn gợi ý",

  "upload.source":
    "Nguồn: nội dung CV{github}{pages}{characters} · {model} · {seconds} giây{truncated}. {githubNote} {aiNote}",
  "upload.source.github": " + {count} mục GitHub công khai",
  "upload.source.pages": " · {count} trang",
  "upload.source.characters": " · {count} ký tự",
  "upload.source.truncated": " · CV đã được rút gọn",
  "upload.source.githubAuto": "Repository được trích tự động từ CV.",
  "upload.source.githubPublicNote":
    "GitHub chỉ đọc dữ liệu công khai và có thể chậm hơn CV.",
  "upload.source.githubFailed":
    "Chưa đọc được dữ liệu GitHub; kết quả dựa trên CV.",
  "upload.source.aiNote":
    "Kết quả do AI tạo; cần đối chiếu với CV gốc trước khi quyết định.",

  "upload.queueTitle": "Hàng đợi phân tích",
  "upload.queueMeta": "{count} hồ sơ gần đây",
  "upload.allFiles": "Tất cả hồ sơ",
  "upload.colCandidate": "Hồ sơ",
  "upload.colPosition": "Vị trí",
  "upload.colStage": "Công đoạn",
  "upload.colTime": "Thời gian",
  "upload.colStatus": "Trạng thái",
  "upload.colOpenAria": "Mở hồ sơ",
  "upload.queueStateQueued": "Chờ xử lý",
  "upload.queueOpenAria": "Mở {name}",
  "upload.queueStageDone": "Hoàn tất · {count} tiêu chí",
  "upload.queueStageExtracting": "Đang trích xuất bằng chứng",
  "upload.queueTimeMinutesAgo": "{count} phút trước",
  "upload.queueTimeYesterday": "Hôm qua",
  "upload.queueTimeJustNow": "Vừa xong",
  "upload.queueNote":
    "Phân tích gồm 6 công đoạn: đọc CV, trích xuất kỹ năng, đọc GitHub công khai, đối chiếu JD, đánh giá bằng chứng, tạo câu hỏi.",

  "upload.previewAria": "Xem trước {name}",
  "upload.openPdfTab": "Mở PDF trong tab mới",
  "upload.closePreview": "Đóng xem trước",
} as const;

const en: Record<keyof typeof vi, Message> = {
  "upload.loading": "Loading positions and analysis stages…",
  "upload.sub":
    "Upload a CV, match it against the job description and build verifiable evidence.",
  "upload.history": "Analysis history",
  "upload.errorTitle": "Couldn't analyze the CV",

  "upload.uploadCardTitle": "Upload file",
  "upload.uploadCardMeta": "PDF, DOCX · up to 10 MB",
  "upload.dropTitle": "Drag and drop a CV here",
  "upload.dropSub":
    "or pick a file from your computer · PDF, DOCX · up to 10 MB",
  "upload.dropAria": "Choose or drag and drop a CV file",
  "upload.previewPdfAria": "Preview PDF",
  "upload.clearFileAria": "Remove the selected file",
  "upload.levelLabel": "Evaluation level",
  "upload.repoNote":
    "GitHub links in the CV are read through the GitHub API: public repos have their source analyzed, personal profiles have every public repo scanned.",
  "upload.filePolicy":
    "The file is stored in the Product Engineering workspace and used only for hiring evaluation.",

  "upload.error.type": "Only PDF and DOCX CVs are supported. Choose another file.",
  "upload.error.empty": "The file is empty. Choose another file.",
  "upload.error.tooLarge":
    "The file is over 10 MB. Compress or re-export the CV and try again.",
  "upload.error.server": "The server returned error {status}. Try again later.",
  "upload.error.network":
    "Couldn't reach the analysis server. Check your network connection and try again.",
  "upload.error.timeout":
    "The analysis took longer than 150 seconds. Try again or use Gemini 3.1 Flash Lite.",

  "upload.fileNote.done": {
    one: "{count} criterion compared",
    other: "{count} criteria compared",
  },
  "upload.fileNote.donePages": {
    one: "{pages} pages · {count} criterion compared",
    other: "{pages} pages · {count} criteria compared",
  },
  "upload.fileNote.uploading": "uploading to the server",
  "upload.fileNote.analyzing": "analyzing with Gemini",
  "upload.fileNote.error": "analysis not finished",
  "upload.fileNote.idle": "ready to analyze",

  "upload.configTitle": "Analysis settings",
  "upload.queuedLead": "Analyzed ",
  "upload.queuedTail": ".",
  "upload.viewResult": "View result",
  "upload.teamLabel": "Specialization",
  "upload.positionLabel": "Reference position",
  "upload.languageLabel": "Evaluation language",
  "upload.langVi": "Vietnamese",
  "upload.langEn": "English",
  "upload.modelLabel": "Analysis model",
  "upload.noModelOption": "No active model yet",

  "upload.jdLabel": "Match against the JD",
  "upload.jdHint": "Show which criteria are met and what's missing.",
  "upload.questionsLabel": "Generate interview questions",
  "upload.questionsHint":
    "Questions follow the evidence instead of being generic.",

  "upload.stageCount": {
    one: "{count} analysis stage",
    other: "{count} analysis stages",
  },
  "upload.progressUploadTitle": "Upload file",
  "upload.progressUploading": "Sending the file to the server",
  "upload.progressReceived": "File received",
  "upload.progressAnalyzeTitle": "Analyze the profile",
  "upload.progressAnalyzeDetail": {
    one: "Extract content and compare {count} criterion",
    other: "Extract content and compare {count} criteria",
  },
  "upload.progressNote":
    "No estimated percentage is shown; timing depends on CV length and model.",

  "upload.submit": "Start analysis",
  "upload.submitUploading": "Uploading CV…",
  "upload.submitAnalyzing": "Analyzing…",
  "upload.hintPick": "Choose a CV to start.",
  "upload.hintRunning": "Processing with {model}. Don't close the tab.",
  "upload.hintNoModel":
    "Enable at least one model in Settings → AI models to analyze.",

  "upload.resultTitle": "Analysis result",
  "upload.resultMeta": {
    one: "{count} criterion · {model}",
    other: "{count} criteria · {model}",
  },
  "upload.viewPdf": "View PDF",
  "upload.downloadJson": "Download JSON",
  "upload.analyzeAnother": "Analyze another CV",
  "upload.statusAnalyzed": "Analyzed",
  "upload.yearsExperience": {
    one: "{count} year of experience",
    other: "{count} years of experience",
  },
  "upload.roleUnknown": "Current title not detected",

  "upload.reposLabel": "Repository & GitHub",
  "upload.githubMeta": "Read {analyzed}/{targets} GitHub items",
  "upload.githubMetaPublic":
    "Read {analyzed}/{targets} GitHub items · {public} public repos",
  "upload.repoRead": "Read",
  "upload.repoSkipped": "Skipped",
  "upload.repoUnread": "Not read",
  "upload.reposEmpty": "The CV doesn't mention a public repository.",

  "upload.evidenceLabel": "Evidence",
  "upload.criteriaTitle": "Criteria match",
  "upload.criteriaMust": "Required",
  "upload.criteriaNice": "Preferred",
  "upload.strengthsTitle": "Strengths with evidence",
  "upload.gapsTitle": "To verify",
  "upload.questionsTitle": "Suggested interview questions",

  "upload.source":
    "Source: CV content{github}{pages}{characters} · {model} · {seconds} seconds{truncated}. {githubNote} {aiNote}",
  "upload.source.github": {
    one: " + {count} public GitHub item",
    other: " + {count} public GitHub items",
  },
  "upload.source.pages": {
    one: " · {count} page",
    other: " · {count} pages",
  },
  "upload.source.characters": {
    one: " · {count} character",
    other: " · {count} characters",
  },
  "upload.source.truncated": " · CV was shortened",
  "upload.source.githubAuto": "Repositories are extracted automatically from the CV.",
  "upload.source.githubPublicNote":
    "GitHub only reads public data and may be slower than the CV.",
  "upload.source.githubFailed":
    "GitHub data couldn't be read; the result is based on the CV.",
  "upload.source.aiNote":
    "AI-generated; check against the original CV before deciding.",

  "upload.queueTitle": "Analysis queue",
  "upload.queueMeta": {
    one: "{count} recent file",
    other: "{count} recent files",
  },
  "upload.allFiles": "All files",
  "upload.colCandidate": "File",
  "upload.colPosition": "Position",
  "upload.colStage": "Stage",
  "upload.colTime": "Time",
  "upload.colStatus": "Status",
  "upload.colOpenAria": "Open file",
  "upload.queueStateQueued": "Queued",
  "upload.queueOpenAria": "Open {name}",
  "upload.queueStageDone": {
    one: "Completed · {count} criterion",
    other: "Completed · {count} criteria",
  },
  "upload.queueStageExtracting": "Extracting evidence",
  "upload.queueTimeMinutesAgo": {
    one: "{count} minute ago",
    other: "{count} minutes ago",
  },
  "upload.queueTimeYesterday": "Yesterday",
  "upload.queueTimeJustNow": "Just now",
  "upload.queueNote":
    "Analysis has 6 stages: read the CV, extract skills, read public GitHub, match the JD, assess evidence, generate questions.",

  "upload.previewAria": "Preview {name}",
  "upload.openPdfTab": "Open PDF in a new tab",
  "upload.closePreview": "Close preview",
};

export const uploadMessages = { vi, en };
