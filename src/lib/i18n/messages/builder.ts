import type { Message } from "../types";

const vi = {
  "nav.builder": "Tạo CV AI",
  "screen.builder": "Tạo CV AI",
  "builder.sub":
    "Nhập thông tin cơ bản, AI viết nội dung chuẩn ATS và chọn mẫu trình bày.",

  "builder.profileTitle": "Thông tin cơ bản",
  "builder.profileMeta": "Họ tên và vị trí ứng tuyển là bắt buộc",
  "builder.prefillLabel": "Nạp từ hồ sơ đã phân tích",
  "builder.prefillPlaceholder": "Chọn hồ sơ…",
  "builder.prefillAction": "Nạp thông tin",
  "builder.prefillEmpty": "Chưa có hồ sơ nào đã phân tích. Nhập tay bên dưới.",
  "builder.prefillDone":
    "Đã nạp liên hệ, vị trí, cấp bậc và kỹ năng từ {name}.",

  "builder.fullName": "Họ và tên",
  "builder.position": "Vị trí ứng tuyển",
  "builder.positionPlaceholder": "Chọn vị trí ứng tuyển…",
  "builder.email": "Email",
  "builder.phone": "Số điện thoại",
  "builder.location": "Địa điểm",
  "builder.years": "Số năm kinh nghiệm",
  "builder.level": "Cấp bậc",
  "builder.linkedin": "LinkedIn",
  "builder.github": "GitHub",
  "builder.portfolio": "Portfolio / Website",
  "builder.notes": "Thành tích & điểm mạnh",
  "builder.notesPlaceholder":
    "Thành tích nổi bật, điểm mạnh, mục tiêu nghề nghiệp…",
  "builder.skills": "Kỹ năng",
  "builder.skillsHint":
    "Phân tách bằng dấu phẩy. AI chỉ dùng đúng kỹ năng bạn nhập.",
  "builder.skillsPlaceholder": "React, TypeScript, PostgreSQL, Docker",
  "builder.skillPickerPlaceholder": "Tìm và chọn kỹ năng, ngôn ngữ…",
  "builder.skillPickerEmpty": "Không tìm thấy kỹ năng phù hợp.",
  "builder.skillGroupLanguages": "Ngôn ngữ lập trình",
  "builder.skillGroupFrontend": "Frontend",
  "builder.skillGroupBackend": "Backend & dữ liệu",
  "builder.skillGroupDevops": "DevOps & cloud",
  "builder.skillGroupData": "Dữ liệu & thiết kế",
  "builder.certifications": "Chứng chỉ",
  "builder.certificationsHint":
    "Mỗi dòng một chứng chỉ, kèm năm hoặc tổ chức nếu có.",
  "builder.languages": "Ngoại ngữ",
  "builder.languagesHint":
    "Mỗi dòng một ngoại ngữ, ví dụ English — IELTS 7.0.",
  "builder.listPlaceholder": "Mỗi dòng một mục",
  "builder.avatarLabel": "Ảnh đại diện",
  "builder.avatarUpload": "Chọn ảnh",
  "builder.avatarRemove": "Xoá ảnh",
  "builder.avatarHint":
    "Ảnh được cắt vuông và in kèm trên CV. JPG/PNG tối đa 5 MB.",
  "builder.avatarError":
    "Không đọc được ảnh. Chọn tệp JPG, PNG hoặc WebP dưới 5 MB.",
  "builder.draftSave": "Lưu nháp thông tin",
  "builder.draftSaving": "Đang lưu nháp…",
  "builder.draftSaved":
    "Đã lưu nháp. Mở lại Tạo CV AI sẽ khôi phục thông tin này.",
  "builder.draftRestored":
    "Đã khôi phục thông tin từ bản nháp đã lưu.",
  "builder.draftError": "Không lưu được bản nháp",

  "builder.experienceTitle": "Kinh nghiệm làm việc",
  "builder.experienceEmpty": "Chưa có kinh nghiệm nào. Thêm mục đầu tiên.",
  "builder.addExperience": "Thêm kinh nghiệm",
  "builder.company": "Công ty",
  "builder.entryRole": "Vai trò",
  "builder.period": "Thời gian",
  "builder.periodPlaceholder": "01/2022 – nay",
  "builder.description": "Mô tả",
  "builder.descriptionPlaceholder":
    "Việc đã làm, công nghệ dùng, kết quả đo được…",
  "builder.entryIndex": "Mục {index}",
  "builder.removeEntry": "Xoá mục {index}",

  "builder.educationTitle": "Học vấn",
  "builder.educationEmpty": "Chưa có học vấn nào.",
  "builder.addEducation": "Thêm học vấn",
  "builder.school": "Trường",
  "builder.degree": "Bằng cấp",

  "builder.projectsTitle": "Dự án",
  "builder.projectsEmpty": "Chưa có dự án nào.",
  "builder.addProject": "Thêm dự án",
  "builder.projectName": "Tên dự án",

  "builder.styleTitle": "AI & phong cách",
  "builder.styleMeta": "Model, ngôn ngữ và mẫu trình bày",
  "builder.modelLabel": "Model AI",
  "builder.noModelOption": "Chưa có model nào đang bật",
  "builder.cvLanguageLabel": "Ngôn ngữ CV",
  "builder.languageVi": "Tiếng Việt",
  "builder.languageEn": "English",
  "builder.templateLabel": "Mẫu CV",
  "builder.templateAuto": "AI tự chọn",
  "builder.templateClassic": "Classic · một cột, trang trọng",
  "builder.templateSidebar": "Sidebar · kỹ năng ở cột trái",
  "builder.templateCompact": "Compact · gọn trong một trang",
  "builder.templateClassicName": "Classic",
  "builder.templateSidebarName": "Sidebar",
  "builder.templateCompactName": "Compact",
  "builder.accentLabel": "Màu nhấn",
  "builder.accentAuto": "AI tự chọn",
  "builder.accentSky": "Sky · xanh dương",
  "builder.accentSlate": "Slate · xám trung tính",
  "builder.accentEmerald": "Emerald · xanh lá",
  "builder.accentAmber": "Amber · hổ phách",
  "builder.accentSkyName": "Sky",
  "builder.accentSlateName": "Slate",
  "builder.accentEmeraldName": "Emerald",
  "builder.accentAmberName": "Amber",

  "builder.feedbackLabel": "Yêu cầu chỉnh sửa",
  "builder.feedbackHint":
    "Dùng khi tạo lại: nhấn mạnh phần nào, viết ngắn hơn, đổi giọng văn…",
  "builder.feedbackPlaceholder":
    "Ví dụ: nhấn mạnh dự án thanh toán, viết ngắn hơn, giọng chuyên nghiệp hơn.",
  "builder.generate": "Tạo CV bằng AI",
  "builder.generating": "AI đang viết CV…",
  "builder.generateHint":
    "Thời gian phụ thuộc model; không đóng tab trong lúc chờ.",
  "builder.groundingNote":
    "AI không bịa công ty, chức danh, thời gian hay số liệu; chỉ viết lại và sắp xếp thông tin bạn cung cấp.",

  "builder.validation":
    "Nhập họ tên, vị trí ứng tuyển và ít nhất một kinh nghiệm, học vấn, dự án hoặc kỹ năng.",
  "builder.noModelError":
    "Chưa có model AI đang bật. Bật model trong Cài đặt → AI models.",
  "builder.errorTitle": "Không thể tạo CV",

  "builder.resultTitle": "Bản nháp CV",
  "builder.resultMeta": "{template} · {accent} · {model}",
  "builder.resultHint":
    "Bản nháp chưa được lưu. Bấm Lưu CV để giữ lại trong CV của tôi.",
  "builder.saveName": "Tên CV",
  "builder.saveNamePlaceholder": "VD: Backend Engineer · Acme",
  "builder.save": "Lưu CV",
  "builder.update": "Cập nhật CV",
  "builder.saving": "Đang lưu…",
  "builder.saveDone": "Đã lưu CV. Xem lại trong CV của tôi.",
  "builder.saveUpdated": "Đã cập nhật CV đã lưu.",
  "builder.saveErrorTitle": "Không lưu được CV",
  "builder.editingSaved": "Đang chỉnh sửa CV đã lưu.",
  "builder.loadingSaved": "Đang tải CV đã lưu…",
  "builder.loadSavedError": "Không tải được CV đã lưu.",
  "builder.resultEmptyTitle": "Chưa có bản nháp",
  "builder.resultEmptyDetail":
    "Điền thông tin và bấm Tạo CV bằng AI để xem nội dung do AI viết.",
  "builder.resultContentEmpty":
    "AI chưa trả về nội dung nào. Thử tạo lại với mô tả chi tiết hơn.",
  "builder.print": "In / Tải PDF",
  "builder.printHint":
    "Trong hộp thoại in, chọn Save as PDF để lưu bản A4.",
  "builder.analyze": "Phân tích CV",
  "builder.analyzing": "AI đang phân tích…",
  "builder.analyzeHint":
    "AI đối chiếu bản nháp với tiêu chí của vị trí ứng tuyển.",
  "builder.analyzePositionError":
    "Nhập vị trí ứng tuyển trong biểu mẫu để phân tích CV.",
  "builder.reviewTitle": "Kết quả phân tích CV",
  "builder.reviewMeta": "{model} · {seconds}s",
  "builder.reviewEvidence": "Mức độ đáp ứng",
  "builder.reviewCriteria": "Đối chiếu tiêu chí",
  "builder.reviewStrengths": "Điểm mạnh",
  "builder.reviewGaps": "Cần làm rõ",
  "builder.reviewNote":
    "Kết quả chỉ để tham khảo cho bản nháp này; không lưu thành hồ sơ ứng viên.",
  "builder.reviewErrorTitle": "Không phân tích được CV",
  "builder.previewFrameTitle": "Bản xem trước CV",
  "builder.resultSummary": "Tóm tắt",
  "builder.resultExperience": "Kinh nghiệm làm việc",
  "builder.resultEducation": "Học vấn",
  "builder.resultProjects": "Dự án",
  "builder.resultSkills": "Kỹ năng",
  "builder.resultCertifications": "Chứng chỉ",
  "builder.resultLanguages": "Ngoại ngữ",

  "savedCvs.sub": "CV do AI tạo và lưu riêng cho tài khoản của bạn.",
  "savedCvs.newCv": "Tạo CV mới",
  "savedCvs.listTitle": "CV đã lưu",
  "savedCvs.listMeta": "{count} CV",
  "savedCvs.emptyTitle": "Chưa có CV nào được lưu",
  "savedCvs.emptyDetail":
    "Tạo CV bằng AI, sau đó bấm Lưu CV để xem lại tại đây.",
  "savedCvs.noRole": "Chưa có vị trí",
  "savedCvs.open": "Xem CV",
  "savedCvs.updated": "Cập nhật {date}",
  "savedCvs.openBuilder": "Chỉnh sửa",
  "savedCvs.saveStyle": "Lưu mẫu",
  "savedCvs.styleSaved": "Đã lưu mẫu trình bày.",
  "savedCvs.styleError": "Không lưu được mẫu trình bày.",
  "savedCvs.delete": "Xoá CV",
  "savedCvs.deleteConfirmTitle": "Xoá CV này?",
  "savedCvs.deleteConfirmDetail":
    "CV đã lưu sẽ bị xoá vĩnh viễn khỏi tài khoản.",
  "savedCvs.deleteError": "Không xoá được CV. Vui lòng thử lại.",
  "savedCvs.notFound": "Không tìm thấy CV hoặc bạn không có quyền truy cập.",
  "savedCvs.evaluate": "Đánh giá CV",
  "savedCvs.evaluating": "AI đang đánh giá…",
  "savedCvs.evalTitle": "Kết quả đánh giá CV",
  "savedCvs.evalNote":
    "Kết quả chỉ để tham khảo; CV đã lưu không bị thay đổi.",
  "savedCvs.evalErrorTitle": "Không đánh giá được CV",
  "savedCvs.evalPosition":
    "CV chưa có vị trí ứng tuyển. Mở Builder bổ sung vị trí rồi đánh giá.",
};

const en: Record<keyof typeof vi, Message> = {
  "nav.builder": "AI CV Builder",
  "screen.builder": "AI CV Builder",
  "builder.sub":
    "Enter the essentials and AI writes ATS-friendly content and picks the layout.",

  "builder.profileTitle": "Basic details",
  "builder.profileMeta": "Full name and target role are required",
  "builder.prefillLabel": "Prefill from an analyzed candidate",
  "builder.prefillPlaceholder": "Choose a candidate…",
  "builder.prefillAction": "Prefill",
  "builder.prefillEmpty": "No analyzed candidates yet. Fill the form manually.",
  "builder.prefillDone":
    "Contact details, role, level and skills filled from {name}.",

  "builder.fullName": "Full name",
  "builder.position": "Target role",
  "builder.positionPlaceholder": "Select a target role…",
  "builder.email": "Email",
  "builder.phone": "Phone",
  "builder.location": "Location",
  "builder.years": "Years of experience",
  "builder.level": "Level",
  "builder.linkedin": "LinkedIn",
  "builder.github": "GitHub",
  "builder.portfolio": "Portfolio / Website",
  "builder.notes": "Achievements & strengths",
  "builder.notesPlaceholder":
    "Standout achievements, strengths, career goals…",
  "builder.skills": "Skills",
  "builder.skillsHint":
    "Separate with commas. AI only uses the skills you enter.",
  "builder.skillsPlaceholder": "React, TypeScript, PostgreSQL, Docker",
  "builder.skillPickerPlaceholder": "Search and pick skills, languages…",
  "builder.skillPickerEmpty": "No matching skills found.",
  "builder.skillGroupLanguages": "Programming languages",
  "builder.skillGroupFrontend": "Frontend",
  "builder.skillGroupBackend": "Backend & data",
  "builder.skillGroupDevops": "DevOps & cloud",
  "builder.skillGroupData": "Data & design",
  "builder.certifications": "Certifications",
  "builder.certificationsHint":
    "One certification per line, with year or issuer if available.",
  "builder.languages": "Languages",
  "builder.languagesHint":
    "One language per line, e.g. English — IELTS 7.0.",
  "builder.listPlaceholder": "One item per line",
  "builder.avatarLabel": "Profile photo",
  "builder.avatarUpload": "Choose photo",
  "builder.avatarRemove": "Remove photo",
  "builder.avatarHint":
    "Cropped square and printed on the CV. JPG/PNG up to 5 MB.",
  "builder.avatarError":
    "Could not read the image. Choose a JPG, PNG or WebP under 5 MB.",
  "builder.draftSave": "Save draft",
  "builder.draftSaving": "Saving draft…",
  "builder.draftSaved":
    "Draft saved. Reopening the AI CV Builder restores these details.",
  "builder.draftRestored":
    "Restored the details from your saved draft.",
  "builder.draftError": "Could not save the draft",

  "builder.experienceTitle": "Work experience",
  "builder.experienceEmpty": "No experience yet. Add the first entry.",
  "builder.addExperience": "Add experience",
  "builder.company": "Company",
  "builder.entryRole": "Role",
  "builder.period": "Period",
  "builder.periodPlaceholder": "01/2022 – present",
  "builder.description": "Description",
  "builder.descriptionPlaceholder":
    "What you did, the tech used, measurable outcomes…",
  "builder.entryIndex": "Entry {index}",
  "builder.removeEntry": "Remove entry {index}",

  "builder.educationTitle": "Education",
  "builder.educationEmpty": "No education yet.",
  "builder.addEducation": "Add education",
  "builder.school": "School",
  "builder.degree": "Degree",

  "builder.projectsTitle": "Projects",
  "builder.projectsEmpty": "No projects yet.",
  "builder.addProject": "Add project",
  "builder.projectName": "Project name",

  "builder.styleTitle": "AI & style",
  "builder.styleMeta": "Model, language and layout",
  "builder.modelLabel": "AI model",
  "builder.noModelOption": "No active model",
  "builder.cvLanguageLabel": "CV language",
  "builder.languageVi": "Vietnamese",
  "builder.languageEn": "English",
  "builder.templateLabel": "Template",
  "builder.templateAuto": "Let AI choose",
  "builder.templateClassic": "Classic · single column, formal",
  "builder.templateSidebar": "Sidebar · skills in a left column",
  "builder.templateCompact": "Compact · fits one page",
  "builder.templateClassicName": "Classic",
  "builder.templateSidebarName": "Sidebar",
  "builder.templateCompactName": "Compact",
  "builder.accentLabel": "Accent color",
  "builder.accentAuto": "Let AI choose",
  "builder.accentSky": "Sky · blue",
  "builder.accentSlate": "Slate · neutral gray",
  "builder.accentEmerald": "Emerald · green",
  "builder.accentAmber": "Amber · warm amber",
  "builder.accentSkyName": "Sky",
  "builder.accentSlateName": "Slate",
  "builder.accentEmeraldName": "Emerald",
  "builder.accentAmberName": "Amber",

  "builder.feedbackLabel": "Revision notes",
  "builder.feedbackHint":
    "For regenerating: what to emphasize, shorter copy, a different tone…",
  "builder.feedbackPlaceholder":
    "E.g. emphasize the payments project, keep it shorter, more formal tone.",
  "builder.generate": "Generate CV with AI",
  "builder.generating": "AI is writing your CV…",
  "builder.generateHint":
    "Duration depends on the model; keep this tab open while waiting.",
  "builder.groundingNote":
    "AI never invents companies, titles, dates or metrics; it only rewrites and organizes what you provide.",

  "builder.validation":
    "Enter a full name, a target role and at least one experience, education, project or skill.",
  "builder.noModelError":
    "No active AI model. Turn one on in Settings → AI models.",
  "builder.errorTitle": "Could not generate the CV",

  "builder.resultTitle": "CV draft",
  "builder.resultMeta": "{template} · {accent} · {model}",
  "builder.resultHint":
    "This draft is not saved yet. Press Save CV to keep it in My CVs.",
  "builder.saveName": "CV name",
  "builder.saveNamePlaceholder": "E.g. Backend Engineer · Acme",
  "builder.save": "Save CV",
  "builder.update": "Update CV",
  "builder.saving": "Saving…",
  "builder.saveDone": "CV saved. Find it in My CVs.",
  "builder.saveUpdated": "Saved CV updated.",
  "builder.saveErrorTitle": "Could not save the CV",
  "builder.editingSaved": "Editing a saved CV.",
  "builder.loadingSaved": "Loading the saved CV…",
  "builder.loadSavedError": "Could not load the saved CV.",
  "builder.resultEmptyTitle": "No draft yet",
  "builder.resultEmptyDetail":
    "Fill the form and press Generate CV with AI to see the AI-written content.",
  "builder.resultContentEmpty":
    "The AI returned no content. Try again with more detail.",
  "builder.print": "Print / Save PDF",
  "builder.printHint":
    "In the print dialog, choose Save as PDF to keep an A4 file.",
  "builder.analyze": "Analyze CV",
  "builder.analyzing": "AI is analyzing…",
  "builder.analyzeHint":
    "AI reviews the draft against the target role criteria.",
  "builder.analyzePositionError":
    "Enter a target role in the form to analyze the CV.",
  "builder.reviewTitle": "CV analysis",
  "builder.reviewMeta": "{model} · {seconds}s",
  "builder.reviewEvidence": "Criteria coverage",
  "builder.reviewCriteria": "Criteria match",
  "builder.reviewStrengths": "Strengths",
  "builder.reviewGaps": "To clarify",
  "builder.reviewNote":
    "This review is for the draft only; no candidate profile is saved.",
  "builder.reviewErrorTitle": "Could not analyze the CV",
  "builder.previewFrameTitle": "CV preview",
  "builder.resultSummary": "Summary",
  "builder.resultExperience": "Work experience",
  "builder.resultEducation": "Education",
  "builder.resultProjects": "Projects",
  "builder.resultSkills": "Skills",
  "builder.resultCertifications": "Certifications",
  "builder.resultLanguages": "Languages",

  "savedCvs.sub": "CVs written by AI and stored privately in your account.",
  "savedCvs.newCv": "Create a CV",
  "savedCvs.listTitle": "Saved CVs",
  "savedCvs.listMeta": {
    one: "{count} CV",
    other: "{count} CVs",
  },
  "savedCvs.emptyTitle": "No saved CVs yet",
  "savedCvs.emptyDetail":
    "Generate a CV with AI, then press Save CV to see it here.",
  "savedCvs.noRole": "No target role",
  "savedCvs.open": "Open CV",
  "savedCvs.updated": "Updated {date}",
  "savedCvs.openBuilder": "Edit",
  "savedCvs.saveStyle": "Save layout",
  "savedCvs.styleSaved": "Layout saved.",
  "savedCvs.styleError": "Could not save the layout.",
  "savedCvs.delete": "Delete CV",
  "savedCvs.deleteConfirmTitle": "Delete this CV?",
  "savedCvs.deleteConfirmDetail":
    "The saved CV will be permanently removed from your account.",
  "savedCvs.deleteError": "Could not delete the CV. Please try again.",
  "savedCvs.notFound": "CV not found or you don't have access to it.",
  "savedCvs.evaluate": "Evaluate CV",
  "savedCvs.evaluating": "AI is reviewing…",
  "savedCvs.evalTitle": "CV evaluation",
  "savedCvs.evalNote":
    "For reference only; the saved CV is not changed.",
  "savedCvs.evalErrorTitle": "Could not evaluate the CV",
  "savedCvs.evalPosition":
    "This CV has no target role. Add one in the Builder, then evaluate.",
};

export const builderMessages = { vi, en };
