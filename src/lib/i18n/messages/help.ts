import type { Message } from "../types";

const vi = {
  "screen.help": "Trợ giúp & tài liệu",
  "help.sub":
    "Hướng dẫn ngắn cho từng bước: từ tải CV, đọc bằng chứng đến phỏng vấn và báo cáo.",
  "help.cta": "Phân tích CV mới",
  "help.toc": "Mục lục",
  "help.tocAria": "Mục lục trợ giúp",
  "help.toc.start": "Bắt đầu nhanh",
  "help.toc.pipeline": "Quy trình phân tích",
  "help.toc.evidence": "Mức bằng chứng",
  "help.toc.repo": "Đọc repository",
  "help.toc.interview": "Phỏng vấn & rubric",
  "help.toc.roles": "Vai trò & quyền",
  "help.toc.settings": "Cấu hình",
  "help.toc.faq": "Câu hỏi thường gặp",

  "help.start.title": "Bắt đầu nhanh",
  "help.start.meta": "4 bước từ CV đến báo cáo",
  "help.start.s1.title": "Tải CV lên",
  "help.start.s1.text":
    "Chọn tệp PDF hoặc DOCX, chọn Chuyên môn, Vị trí đối chiếu và model phân tích trước khi chạy.",
  "help.start.s1.action": "Đi tới Phân tích CV",
  "help.start.s2.title": "Đọc bằng chứng",
  "help.start.s2.text":
    "Mở hồ sơ và xem tab Bằng chứng: mỗi tiêu chí có mức bằng chứng, câu trích nguồn và ghi chú.",
  "help.start.s2.action": "Mở danh sách ứng viên",
  "help.start.s3.title": "Phỏng vấn",
  "help.start.s3.text":
    "Dùng câu hỏi sinh từ bằng chứng, đánh dấu câu đã hỏi và chấm rubric 0–4 cho từng tiêu chí.",
  "help.start.s3.action": "Mở phòng phỏng vấn",
  "help.start.s4.title": "Xuất báo cáo",
  "help.start.s4.text":
    "Xuất CSV cho danh sách ứng viên hoặc báo cáo Markdown cho từng hồ sơ để chia sẻ với đội.",
  "help.start.s4.action": "Xem báo cáo",

  "help.pipeline.title": "Quy trình phân tích",
  "help.pipeline.meta": "6 công đoạn · chỉnh tại Cài đặt → Công đoạn",
  "help.pipeline.1.title": "Đọc tệp",
  "help.pipeline.1.text": "Kiểm tra định dạng và dung lượng tệp trước khi gửi lên máy chủ.",
  "help.pipeline.2.title": "Trích xuất CV",
  "help.pipeline.2.text":
    "Đọc thông tin liên hệ, kinh nghiệm, kỹ năng và repository trong CV.",
  "help.pipeline.3.title": "Đối chiếu JD",
  "help.pipeline.3.text":
    "So khớp tiêu chí của vị trí với nguồn bằng chứng trong CV và GitHub.",
  "help.pipeline.4.title": "Đọc GitHub",
  "help.pipeline.4.text":
    "Đọc repository hoặc hồ sơ GitHub công khai được nêu trong CV.",
  "help.pipeline.5.title": "Sinh câu hỏi",
  "help.pipeline.5.text": "Tạo câu hỏi, câu trả lời mẫu và rubric chấm điểm.",
  "help.pipeline.6.title": "Hoàn tất",
  "help.pipeline.6.text": "Tạo báo cáo, lưu hồ sơ và mở sang review.",

  "help.evidence.title": "Ba mức bằng chứng",
  "help.evidence.meta": "Áp dụng cho mọi tiêu chí và bộ lọc",
  "help.evidence.verified.text":
    "Có câu trích nguyên văn từ CV hoặc dữ liệu GitHub — đủ căn cứ để chấm điểm.",
  "help.evidence.inferred.text":
    "Suy ra từ ngữ cảnh nhưng chưa có câu trích trực tiếp — cần xác minh khi phỏng vấn.",
  "help.evidence.missing.text":
    "Chưa tìm thấy bằng chứng — hỏi thêm thay vì giả định.",
  "help.evidence.note":
    "Bộ lọc ở màn Ứng viên chia theo ba mức này: tất cả, có xác minh và có khoảng trống.",

  "help.repo.title": "Đọc repository",
  "help.repo.meta": "Từ CV đến mã nguồn",
  "help.repo.b1":
    "Link repository và hồ sơ GitHub công khai được trích ngay từ CV, không cần nhập tay.",
  "help.repo.b2":
    "Mỗi hồ sơ lưu tối đa 20 repository; các repo được đọc lần lượt ở luồng nền sau khi phân tích chính xong.",
  "help.repo.b3":
    "Màn Repository hiển thị branch, commit, cây tệp, phát hiện theo tệp và trạng thái đọc.",
  "help.repo.b4":
    "Trạng thái gồm Đang chờ, Đang phân tích, Đã đọc, Bỏ qua và Không đọc được.",
  "help.repo.callout":
    "Đọc nền giúp tránh giới hạn GitHub API — bạn có thể rời màn hình và quay lại sau.",
  "help.repo.action": "Mở Repository",

  "help.interview.title": "Phỏng vấn & rubric",
  "help.interview.meta": "Câu hỏi bám bằng chứng",
  "help.interview.b1":
    "Mỗi câu hỏi gắn với tiêu chí và bằng chứng, kèm gợi ý, câu trả lời mẫu và điểm cần kiểm tra.",
  "help.interview.b2": "Đánh dấu Đã hỏi để theo dõi tiến độ từng câu.",
  "help.interview.b3":
    "Chấm rubric thang 0–4 cho từng tiêu chí; điểm cập nhật ngay khi chấm.",
  "help.interview.b4":
    "Xuất phiếu phỏng vấn PDF: xem trước bản in rồi lưu tệp gồm điểm rubric, câu đã hỏi và ghi chú.",
  "help.interview.action": "Mở phỏng vấn",

  "help.roles.title": "Vai trò & quyền",
  "help.roles.meta": "Admin và member",
  "help.roles.admin.title": "Admin",
  "help.roles.admin.text":
    "Xem toàn bộ hồ sơ, cấu hình workspace và cấp quyền cho người khác.",
  "help.roles.member.title": "Member",
  "help.roles.member.text":
    "Chỉ thấy hồ sơ mình đã phân tích; trong Cài đặt chỉ mở được Bảo mật & Thông báo.",
  "help.roles.you": "Bạn",
  "help.roles.note":
    "Chỉ admin đổi được vai trò, và hệ thống chặn admin tự hạ quyền chính mình.",

  "help.settings.title": "Cấu hình workspace",
  "help.settings.meta": "9 tab trong Cài đặt",
  "help.settings.metaMember": "Cần quyền admin",
  "help.settings.memberNote":
    "Tài khoản member chỉ mở được tab Bảo mật & Thông báo. Liên hệ admin workspace để thay đổi cấu hình.",
  "help.settings.memberAction": "Mở Bảo mật & Thông báo",

  "help.faq.title": "Câu hỏi thường gặp",
  "help.faq.meta": "Trả lời nhanh",
  "help.faq.q1": "Vì sao một tiêu chí bị đánh dấu Chưa đủ?",
  "help.faq.a1":
    "CV và repository công khai không có câu trích khớp tiêu chí đó. Hãy mô tả rõ hơn trong JD, hoặc dùng câu hỏi gợi ý để xác minh trực tiếp khi phỏng vấn.",
  "help.faq.q2": "Vì sao tôi không thấy hồ sơ của đồng nghiệp?",
  "help.faq.a2":
    "Tài khoản member chỉ thấy hồ sơ do chính mình tải lên. Admin thấy toàn bộ workspace.",
  "help.faq.q3": "Phân tích thất bại hoặc chạy quá lâu thì làm gì?",
  "help.faq.a3":
    "Kiểm tra Nhà cung cấp đã có API key và model đang bật; thử lại với model nhẹ hơn như Gemini 3.1 Flash Lite và không đóng tab khi đang phân tích.",
  "help.faq.q4": "Đổi model phân tích ở đâu?",
  "help.faq.a4":
    "Cài đặt → AI models để bật/tắt model; ở màn Phân tích CV bạn chọn model cho từng lần chạy.",
  "help.faq.q5": "Có phím tắt nào?",
  "help.faq.a5":
    "Nhấn / ở bất kỳ màn hình nào để đưa con trỏ vào ô tìm kiếm toàn workspace.",
  "help.faq.q6": "Đổi ngôn ngữ giao diện thế nào?",
  "help.faq.a6":
    "Dùng nút VI/EN ở chân sidebar. Nội dung do AI tạo và dữ liệu trong DB giữ nguyên ngôn ngữ gốc.",
  "help.foot": "Cần hỗ trợ thêm? Liên hệ quản trị viên workspace của bạn.",
} satisfies Record<string, Message>;

const en: Record<keyof typeof vi, Message> = {
  "screen.help": "Help & docs",
  "help.sub":
    "Short guidance for each step: from uploading a CV and reading evidence to interviews and reports.",
  "help.cta": "Analyze a new CV",
  "help.toc": "Contents",
  "help.tocAria": "Help contents",
  "help.toc.start": "Quick start",
  "help.toc.pipeline": "Analysis pipeline",
  "help.toc.evidence": "Evidence levels",
  "help.toc.repo": "Repository reading",
  "help.toc.interview": "Interview & rubric",
  "help.toc.roles": "Roles & permissions",
  "help.toc.settings": "Configuration",
  "help.toc.faq": "FAQ",

  "help.start.title": "Quick start",
  "help.start.meta": "4 steps from CV to report",
  "help.start.s1.title": "Upload a CV",
  "help.start.s1.text":
    "Pick a PDF or DOCX file, then choose the specialization, target position and analysis model before running.",
  "help.start.s1.action": "Go to CV analysis",
  "help.start.s2.title": "Read the evidence",
  "help.start.s2.text":
    "Open a candidate and check the Evidence tab: every criterion shows its evidence level, source quote and notes.",
  "help.start.s2.action": "Open candidates",
  "help.start.s3.title": "Interview",
  "help.start.s3.text":
    "Use evidence-based questions, mark the ones already asked and score each criterion on the 0–4 rubric.",
  "help.start.s3.action": "Open interview studio",
  "help.start.s4.title": "Export reports",
  "help.start.s4.text":
    "Export a CSV of candidates or a Markdown report per profile to share with the team.",
  "help.start.s4.action": "View reports",

  "help.pipeline.title": "Analysis pipeline",
  "help.pipeline.meta": "6 stages · edit in Settings → Stages",
  "help.pipeline.1.title": "Read the file",
  "help.pipeline.1.text": "Validate the file format and size before uploading.",
  "help.pipeline.2.title": "Extract the CV",
  "help.pipeline.2.text":
    "Read contact details, experience, skills and repositories from the CV.",
  "help.pipeline.3.title": "Match the JD",
  "help.pipeline.3.text":
    "Match position criteria against evidence found in the CV and GitHub.",
  "help.pipeline.4.title": "Read GitHub",
  "help.pipeline.4.text":
    "Read public repositories or GitHub profiles mentioned in the CV.",
  "help.pipeline.5.title": "Generate questions",
  "help.pipeline.5.text": "Produce questions, sample answers and a scoring rubric.",
  "help.pipeline.6.title": "Finish",
  "help.pipeline.6.text": "Create the report, save the profile and move it to review.",

  "help.evidence.title": "Three evidence levels",
  "help.evidence.meta": "Applied to every criterion and filter",
  "help.evidence.verified.text":
    "A verbatim quote from the CV or GitHub data — solid ground for scoring.",
  "help.evidence.inferred.text":
    "Derived from context without a direct quote — confirm it during the interview.",
  "help.evidence.missing.text":
    "No evidence found — ask instead of assuming.",
  "help.evidence.note":
    "Candidate filters follow these levels: all, has verification and has gaps.",

  "help.repo.title": "Repository reading",
  "help.repo.meta": "From CV to source code",
  "help.repo.b1":
    "Repository links and public GitHub profiles are extracted from the CV automatically.",
  "help.repo.b2":
    "Each profile stores up to 20 repositories; they are read one by one in the background after the main analysis finishes.",
  "help.repo.b3":
    "The Repository screen shows branch, commit, file tree, per-file findings and read status.",
  "help.repo.b4":
    "Status values are Waiting, Analyzing, Read, Skipped and Unreadable.",
  "help.repo.callout":
    "Background reading avoids GitHub API limits — you can leave the screen and come back later.",
  "help.repo.action": "Open Repository",

  "help.interview.title": "Interview & rubric",
  "help.interview.meta": "Evidence-driven questions",
  "help.interview.b1":
    "Every question is tied to a criterion and its evidence, with hints, a sample answer and checkpoints.",
  "help.interview.b2": "Mark questions as asked to track progress.",
  "help.interview.b3":
    "Score each criterion on a 0–4 rubric; totals update as you score.",
  "help.interview.b4":
    "Export a PDF interview sheet — preview the print layout first, then save rubric scores, questions asked and notes.",
  "help.interview.action": "Open interview studio",

  "help.roles.title": "Roles & permissions",
  "help.roles.meta": "Admin and member",
  "help.roles.admin.title": "Admin",
  "help.roles.admin.text":
    "See every profile, configure the workspace and grant access to others.",
  "help.roles.member.title": "Member",
  "help.roles.member.text":
    "Only see profiles they analyzed; Settings exposes just Security & notifications.",
  "help.roles.you": "You",
  "help.roles.note":
    "Only admins can change roles, and an admin cannot demote themselves.",

  "help.settings.title": "Workspace configuration",
  "help.settings.meta": "9 tabs in Settings",
  "help.settings.metaMember": "Admin only",
  "help.settings.memberNote":
    "Member accounts can only open Security & notifications. Ask a workspace admin to change configuration.",
  "help.settings.memberAction": "Open Security & notifications",

  "help.faq.title": "Frequently asked questions",
  "help.faq.meta": "Quick answers",
  "help.faq.q1": "Why is a criterion marked as missing?",
  "help.faq.a1":
    "Neither the CV nor the public repositories contain a quote matching that criterion. Describe it more clearly in the JD, or use the suggested question to verify it during the interview.",
  "help.faq.q2": "Why can't I see my colleagues' profiles?",
  "help.faq.a2":
    "Member accounts only see the profiles they uploaded. Admins see the whole workspace.",
  "help.faq.q3": "What should I do when analysis fails or takes too long?",
  "help.faq.a3":
    "Check that Providers has an API key and that the model is enabled; retry with a lighter model such as Gemini 3.1 Flash Lite and keep the tab open while analysis runs.",
  "help.faq.q4": "Where do I change the analysis model?",
  "help.faq.a4":
    "Settings → AI models toggles models; on the CV analysis screen you pick the model for each run.",
  "help.faq.q5": "Are there keyboard shortcuts?",
  "help.faq.a5":
    "Press / on any screen to focus the workspace-wide search field.",
  "help.faq.q6": "How do I change the interface language?",
  "help.faq.a6":
    "Use the VI/EN buttons at the bottom of the sidebar. AI-generated content and database records keep their original language.",
  "help.foot": "Need more help? Contact your workspace administrator.",
};

export const helpMessages = { vi, en };
