import type { Message } from "../types";

const vi = {
  "jobs.loading": "Đang tải danh sách vị trí…",
  "jobs.sub":
    "{count} vị trí đang mở · {teams} team · tiêu chí dùng chung cho CV và repository.",
  "jobs.closeForm": "Đóng form",
  "jobs.create": "Tạo vị trí",

  "jobs.form.title": "Tạo vị trí mới",
  "jobs.form.note": "Tiêu chí có thể bổ sung sau khi tạo.",
  "jobs.form.titleLabel": "Tên vị trí",
  "jobs.form.titlePlaceholder": "Ví dụ: Staff Backend Engineer",
  "jobs.form.team": "Team",
  "jobs.form.level": "Cấp bậc",
  "jobs.form.location": "Địa điểm",

  "jobs.filter.aria": "Lọc theo team",
  "jobs.filter.all": "Tất cả",
  "jobs.resultUnit": "vị trí",

  "jobs.badge.open": "Đang mở",
  "jobs.candidates": "{count} ứng viên",
  "jobs.criteria.title": "Tiêu chí tuyển dụng",
  "jobs.criteria.mustMeta": "Bắt buộc · trọng số {weight} · {verify}",
  "jobs.criteria.niceMeta": "Ưu tiên · trọng số {weight} · {verify}",
  "jobs.criteria.empty": "Chưa có tiêu chí. Bổ sung trước khi phân tích CV.",
  "jobs.updated": "{owner} · cập nhật {updated}",
  "jobs.viewCandidates": "Xem ứng viên",

  "jobs.empty.title": "Không có vị trí trong team này",
  "jobs.empty.detail": "Chọn team khác hoặc tạo vị trí mới.",
  "jobs.note":
    "Mỗi vị trí dùng cùng một bộ tiêu chí để đối chiếu CV và repository, nhờ đó bằng chứng giữa các ứng viên có thể so sánh được.",
} as const;

const en: Record<keyof typeof vi, Message> = {
  "jobs.loading": "Loading positions…",
  "jobs.sub": {
    one: "{count} open position · {teams} team · one criteria set shared across CVs and repositories.",
    other:
      "{count} open positions · {teams} teams · one criteria set shared across CVs and repositories.",
  },
  "jobs.closeForm": "Close form",
  "jobs.create": "Create position",

  "jobs.form.title": "Create a new position",
  "jobs.form.note": "Criteria can be added after the position is created.",
  "jobs.form.titleLabel": "Position title",
  "jobs.form.titlePlaceholder": "e.g. Staff Backend Engineer",
  "jobs.form.team": "Team",
  "jobs.form.level": "Level",
  "jobs.form.location": "Location",

  "jobs.filter.aria": "Filter by team",
  "jobs.filter.all": "All",
  "jobs.resultUnit": {
    one: "position",
    other: "positions",
  },

  "jobs.badge.open": "Open",
  "jobs.candidates": {
    one: "{count} candidate",
    other: "{count} candidates",
  },
  "jobs.criteria.title": "Hiring criteria",
  "jobs.criteria.mustMeta": "Required · weight {weight} · {verify}",
  "jobs.criteria.niceMeta": "Preferred · weight {weight} · {verify}",
  "jobs.criteria.empty": "No criteria yet. Add them before analyzing CVs.",
  "jobs.updated": "{owner} · updated {updated}",
  "jobs.viewCandidates": "View candidates",

  "jobs.empty.title": "No positions in this team",
  "jobs.empty.detail": "Choose another team or create a new position.",
  "jobs.note":
    "Every position uses the same criteria set to assess CVs and repositories, so evidence stays comparable across candidates.",
};

export const jobsMessages = { vi, en };
