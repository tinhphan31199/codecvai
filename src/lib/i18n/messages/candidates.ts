import type { Message } from "../types";

const vi = {
  "candidates.loadingLabel": "Đang tải danh sách ứng viên từ máy chủ…",
  "candidates.sub":
    "{total} hồ sơ trong workspace · {shown} hồ sơ đang hiển thị.",
  "candidates.newAnalysis": "Phân tích CV mới",

  "candidates.searchPlaceholder": "Tìm theo tên, email, vị trí…",
  "candidates.searchAria": "Tìm ứng viên",
  "candidates.clearSearchAria": "Xóa tìm kiếm",

  "candidates.filterStatusAria": "Lọc theo trạng thái",
  "candidates.filterPositionAria": "Lọc theo vị trí",
  "candidates.filterEvidenceAria": "Lọc theo bằng chứng",
  "candidates.sortAria": "Sắp xếp",

  "candidates.statusAll": "Tất cả trạng thái",
  "candidates.allPositions": "Tất cả vị trí",
  "candidates.sortRecent": "Cập nhật gần nhất",
  "candidates.sortEvidence": "Nhiều bằng chứng nhất",
  "candidates.sortName": "Tên A–Z",

  "candidates.evidenceAll": "Tất cả",
  "candidates.evidenceVerified": "Có xác minh",
  "candidates.evidenceGap": "Còn thiếu",
  "candidates.evidenceNone": "Chưa có tiêu chí",
  "candidates.clearFilters": "Xóa bộ lọc",
  "candidates.resultCount": "{count} hồ sơ",

  "candidates.colCandidate": "Ứng viên",
  "candidates.colPosition": "Vị trí",
  "candidates.colExperience": "Kinh nghiệm",
  "candidates.colEvidence": "Bằng chứng",
  "candidates.colStatus": "Trạng thái",
  "candidates.colUpdated": "Cập nhật",
  "candidates.colActionAria": "Mở hồ sơ",
  "candidates.yearsUnit": "năm",
  "candidates.openProfileAria": "Mở hồ sơ {name}",

  "candidates.pageInfo": "Hiển thị {from}–{to} trên {total} hồ sơ",
  "candidates.prev": "Trước",
  "candidates.next": "Sau",

  "candidates.emptyTitle": "Không có hồ sơ khớp bộ lọc",
  "candidates.emptyDetail":
    "Thử xóa bộ lọc hoặc tìm theo tên, email và vị trí khác.",

  "candidates.footReview":
    "{status}: {review} hồ sơ trong toàn workspace. Danh sách hiển thị {shown} hồ sơ.",
  "candidates.updatedAt": "Cập nhật {time}",

  "candidates.noteLead": "Bằng chứng chỉ tính khi có nguồn.",
  "candidates.noteBody":
    "Hồ sơ thiếu bằng chứng vẫn hiển thị đầy đủ; mở hồ sơ để xem nguồn từng tiêu chí.",
} as const;

const en: Record<keyof typeof vi, Message> = {
  "candidates.loadingLabel": "Loading candidates from the server…",
  "candidates.sub":
    "{total} candidates in workspace · {shown} currently shown.",
  "candidates.newAnalysis": "Analyze new CV",

  "candidates.searchPlaceholder": "Search by name, email, position…",
  "candidates.searchAria": "Search candidates",
  "candidates.clearSearchAria": "Clear search",

  "candidates.filterStatusAria": "Filter by status",
  "candidates.filterPositionAria": "Filter by position",
  "candidates.filterEvidenceAria": "Filter by evidence",
  "candidates.sortAria": "Sort",

  "candidates.statusAll": "All statuses",
  "candidates.allPositions": "All positions",
  "candidates.sortRecent": "Recently updated",
  "candidates.sortEvidence": "Most evidence",
  "candidates.sortName": "Name A–Z",

  "candidates.evidenceAll": "All",
  "candidates.evidenceVerified": "Has verification",
  "candidates.evidenceGap": "Has gaps",
  "candidates.evidenceNone": "No criteria yet",
  "candidates.clearFilters": "Clear filters",
  "candidates.resultCount": {
    one: "{count} candidate",
    other: "{count} candidates",
  },

  "candidates.colCandidate": "Candidate",
  "candidates.colPosition": "Position",
  "candidates.colExperience": "Experience",
  "candidates.colEvidence": "Evidence",
  "candidates.colStatus": "Status",
  "candidates.colUpdated": "Updated",
  "candidates.colActionAria": "Open profile",
  "candidates.yearsUnit": "years",
  "candidates.openProfileAria": "Open {name}'s profile",

  "candidates.pageInfo": "Showing {from}–{to} of {total} candidates",
  "candidates.prev": "Previous",
  "candidates.next": "Next",

  "candidates.emptyTitle": "No candidates match the filters",
  "candidates.emptyDetail":
    "Try clearing the filters or searching by a different name, email, or position.",

  "candidates.footReview":
    "{status}: {review} candidates in the workspace. Showing {shown}.",
  "candidates.updatedAt": "Updated {time}",

  "candidates.noteLead": "Evidence only counts when it has a source.",
  "candidates.noteBody":
    "Profiles with missing evidence still display in full; open a profile to see the source for each criterion.",
};

export const candidatesMessages = { vi, en };
