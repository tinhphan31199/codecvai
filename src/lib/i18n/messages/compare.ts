import type { Message } from "../types";

const vi = {
  "nav.compare": "So sánh CV",
  "screen.compare": "So sánh CV",

  "compare.sub":
    "Đặt CV của bạn cạnh các CV trong chợ để thấy mình mạnh ở đâu, còn thiếu gì và nên học gì.",
  "compare.setupTitle": "Chọn CV để so sánh",
  "compare.setupMeta": "1 CV của bạn và tối đa 3 CV trong chợ",
  "compare.myCvLabel": "CV của bạn",
  "compare.myCvPlaceholder": "Chọn CV đã lưu",
  "compare.modelLabel": "Model AI",
  "compare.modelHint": "Model chấm điểm và viết nhận xét.",
  "compare.noModel":
    "Chưa có model AI đang bật. Bật model trong Cài đặt → AI models.",
  "compare.noMyCvTitle": "Chưa có CV nào để so sánh",
  "compare.noMyCvDetail":
    "Tạo CV bằng AI rồi lưu lại, sau đó quay về đây so sánh với chợ.",
  "compare.noMyCvAction": "Tạo CV bằng AI",

  "compare.pickTitle": "Chọn CV trong chợ",
  "compare.pickMeta": {
    one: "{count} CV khớp bộ lọc",
    other: "{count} CV khớp bộ lọc",
  },
  "compare.pickHint": "Chọn tối đa 3 CV. Bấm lại để bỏ chọn.",
  "compare.searchPlaceholder": "Tìm theo tên, vị trí, kỹ năng…",
  "compare.searchAria": "Tìm CV trong chợ",
  "compare.selectedMeta": "Đã chọn {count}/3",
  "compare.clearSelection": "Bỏ chọn tất cả",
  "compare.emptyMarketTitle": "Không tìm thấy CV trong chợ",
  "compare.emptyMarketDetail": "Thử từ khoá khác hoặc xoá bộ lọc tìm kiếm.",
  "compare.marketLoading": "Đang tải CV trong chợ…",

  "compare.start": "So sánh với AI",
  "compare.comparing": "AI đang so sánh…",
  "compare.errorTitle": "Không thể so sánh CV",
  "compare.selectMine": "Chọn CV của bạn để so sánh.",
  "compare.selectMarket": "Chọn ít nhất một CV trong chợ.",
  "compare.noModelError":
    "Chưa có model AI đang bật. Bật model trong Cài đặt → AI models.",
  "compare.note": "Kết quả chỉ để tham khảo và không được lưu vào hồ sơ.",

  "compare.resultTitle": "Bảng so sánh",
  "compare.resultMeta": "Model {model} · {seconds}s",
  "compare.stale": "Lựa chọn đã thay đổi — bấm So sánh để cập nhật.",
  "compare.criterion": "Tiêu chí",
  "compare.sourceMine": "CV của bạn",
  "compare.sourceMarket": "Chợ CV",
  "compare.rowTitle": "Vị trí",
  "compare.rowLevel": "Cấp bậc",
  "compare.rowYears": "Kinh nghiệm",
  "compare.rowCategory": "Chuyên môn",
  "compare.rowSkills": "Kỹ năng",
  "compare.rowSummary": "Tóm tắt",
  "compare.rowHighlights": "Điểm nổi bật",
  "compare.years": "{years} năm",
  "compare.emptyValue": "—",
  "compare.skillsLegend":
    "Kỹ năng có viền đậm là CV chợ có mà CV của bạn chưa có.",

  "compare.verdictTitle": "AI nhận xét",
  "compare.verdictMeta": "{count} CV · {seconds}s",
  "compare.bestPick": "CV mạnh nhất",
  "compare.bestReasons": "Vì sao",
  "compare.myStrengths": "Điểm mạnh của bạn",
  "compare.myGaps": "Cần cải thiện",
  "compare.marketHighlights": "Điểm đáng học từ chợ",
};

const en: Record<keyof typeof vi, Message> = {
  "nav.compare": "Compare CVs",
  "screen.compare": "Compare CVs",

  "compare.sub":
    "Place your CV next to marketplace CVs to see where you are strong, what is missing, and what to learn.",
  "compare.setupTitle": "Pick CVs to compare",
  "compare.setupMeta": "1 of your CVs and up to 3 marketplace CVs",
  "compare.myCvLabel": "Your CV",
  "compare.myCvPlaceholder": "Choose a saved CV",
  "compare.modelLabel": "AI model",
  "compare.modelHint": "The model scores the CVs and writes the review.",
  "compare.noModel":
    "No active AI model. Enable one in Settings → AI models.",
  "compare.noMyCvTitle": "No CV to compare yet",
  "compare.noMyCvDetail":
    "Generate a CV with AI and save it, then come back to compare it with the marketplace.",
  "compare.noMyCvAction": "Create a CV with AI",

  "compare.pickTitle": "Pick marketplace CVs",
  "compare.pickMeta": {
    one: "{count} CV matches the filter",
    other: "{count} CVs match the filter",
  },
  "compare.pickHint": "Pick up to 3 CVs. Click again to remove one.",
  "compare.searchPlaceholder": "Search by name, role, skill…",
  "compare.searchAria": "Search marketplace CVs",
  "compare.selectedMeta": "{count}/3 selected",
  "compare.clearSelection": "Clear selection",
  "compare.emptyMarketTitle": "No marketplace CVs found",
  "compare.emptyMarketDetail": "Try another keyword or clear the search.",
  "compare.marketLoading": "Loading marketplace CVs…",

  "compare.start": "Compare with AI",
  "compare.comparing": "AI is comparing…",
  "compare.errorTitle": "Could not compare the CVs",
  "compare.selectMine": "Pick your CV to compare.",
  "compare.selectMarket": "Pick at least one marketplace CV.",
  "compare.noModelError":
    "No active AI model. Enable one in Settings → AI models.",
  "compare.note": "Results are for reference only and are not saved to any profile.",

  "compare.resultTitle": "Side-by-side comparison",
  "compare.resultMeta": "Model {model} · {seconds}s",
  "compare.stale": "Selection changed — run the comparison again to refresh.",
  "compare.criterion": "Criteria",
  "compare.sourceMine": "Your CV",
  "compare.sourceMarket": "Marketplace",
  "compare.rowTitle": "Role",
  "compare.rowLevel": "Level",
  "compare.rowYears": "Experience",
  "compare.rowCategory": "Specialization",
  "compare.rowSkills": "Skills",
  "compare.rowSummary": "Summary",
  "compare.rowHighlights": "Highlights",
  "compare.years": "{years} years",
  "compare.emptyValue": "—",
  "compare.skillsLegend":
    "Outlined skills are the ones the marketplace CV has and yours does not.",

  "compare.verdictTitle": "AI review",
  "compare.verdictMeta": "{count} CVs · {seconds}s",
  "compare.bestPick": "Strongest CV",
  "compare.bestReasons": "Why",
  "compare.myStrengths": "Your strengths",
  "compare.myGaps": "To improve",
  "compare.marketHighlights": "Worth learning from the marketplace",
};

export const compareMessages = { vi, en };
