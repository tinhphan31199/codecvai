import type { Message } from "../types";

const vi = {
  "status.completed": "Hoàn tất",
  "status.processing": "Đang phân tích",
  "status.review": "Chờ review",
  "status.failed": "Cần xử lý",
  "status.archived": "Lưu trữ",

  "evidence.verified": "Đã xác minh",
  "evidence.verifiedShort": "Đã xác minh",
  "evidence.inferred": "Suy luận từ bằng chứng",
  "evidence.inferredShort": "Suy luận",
  "evidence.missing": "Chưa đủ dữ liệu",
  "evidence.missingShort": "Chưa đủ",

  "severity.high": "Cao",
  "severity.medium": "Trung bình",
  "severity.low": "Thấp",
  "severity.info": "Thông tin",

  "finding.open": "Chưa xử lý",
  "finding.needsCheck": "Cần kiểm tra",
  "finding.confirmed": "Đã xác nhận",
  "finding.dismissed": "Đã bỏ qua",

  "reportStatus.exported": "Đã xuất",
  "reportStatus.review": "Chờ review",
  "reportStatus.failed": "Lỗi",

  "action.save": "Lưu",
  "action.cancel": "Huỷ",
  "action.delete": "Xoá",
  "action.edit": "Sửa",
  "action.add": "Thêm",
  "action.close": "Đóng",
  "action.retry": "Thử lại",
  "action.search": "Tìm kiếm",
  "action.viewAll": "Xem tất cả",
  "action.back": "Quay lại",
  "action.open": "Mở",
  "action.confirm": "Xác nhận",
  "action.confirmDelete": "Xác nhận xoá",

  "state.loading": "Đang tải dữ liệu…",
  "state.loadError": "Không tải được dữ liệu",
  "state.serverError": "Máy chủ trả lời lỗi {status}.",
  "editor.loading": "Đang tải trình soạn thảo…",

  "evidence.meterAria":
    "{verified} tiêu chí đã xác minh, {inferred} suy luận, {missing} chưa đủ dữ liệu trên {total}",
  "evidence.legend": "{verified} đã xác minh · {inferred} suy luận · {missing} chưa đủ",
  "stage.step": "Bước {current}/{total}",
  "stage.aria": "{current} trên {total} công đoạn",
} as const;

const en: Record<keyof typeof vi, Message> = {
  "status.completed": "Completed",
  "status.processing": "Analyzing",
  "status.review": "In review",
  "status.failed": "Needs attention",
  "status.archived": "Archived",

  "evidence.verified": "Verified",
  "evidence.verifiedShort": "Verified",
  "evidence.inferred": "Inferred from evidence",
  "evidence.inferredShort": "Inferred",
  "evidence.missing": "Not enough data",
  "evidence.missingShort": "Missing",

  "severity.high": "High",
  "severity.medium": "Medium",
  "severity.low": "Low",
  "severity.info": "Info",

  "finding.open": "Open",
  "finding.needsCheck": "Needs check",
  "finding.confirmed": "Confirmed",
  "finding.dismissed": "Dismissed",

  "reportStatus.exported": "Exported",
  "reportStatus.review": "In review",
  "reportStatus.failed": "Failed",

  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.delete": "Delete",
  "action.edit": "Edit",
  "action.add": "Add",
  "action.close": "Close",
  "action.retry": "Retry",
  "action.search": "Search",
  "action.viewAll": "View all",
  "action.back": "Back",
  "action.open": "Open",
  "action.confirm": "Confirm",
  "action.confirmDelete": "Confirm delete",

  "state.loading": "Loading data…",
  "state.loadError": "Couldn't load data",
  "state.serverError": "The server responded with error {status}.",
  "editor.loading": "Loading editor…",

  "evidence.meterAria":
    "{verified} verified criteria, {inferred} inferred, {missing} missing out of {total}",
  "evidence.legend": "{verified} verified · {inferred} inferred · {missing} missing",
  "stage.step": "Step {current}/{total}",
  "stage.aria": "{current} of {total} stages",
};

export const commonMessages = { vi, en };
