import type { Message } from "../types";

const vi = {
  "settings.tabsAria": "Trang cấu hình",
  "settings.saveChanges": "Lưu thay đổi",
  "settings.actions": "Thao tác",
  "settings.page.info": "Hiển thị {from}–{to} trên {total}",
  "settings.page.prev": "Trước",
  "settings.page.next": "Sau",

  "settings.tab.security": "Bảo mật & Thông báo",
  "settings.tab.securitySub":
    "Xác thực hai lớp, tự đăng xuất và các thông báo vận hành.",
  "settings.tab.team": "Thành viên",
  "settings.tab.teamSub":
    "Danh mục thành viên dùng cho reviewer và phân quyền hiển thị.",
  "settings.tab.levels": "Cấp bậc",
  "settings.tab.levelsSub":
    "Cấp bậc dùng chung cho vị trí, Upload CV và phân tích hồ sơ.",
  "settings.tab.teams": "Chuyên môn",
  "settings.tab.teamsSub":
    "Danh mục chuyên môn CNTT dùng cho vị trí và phân tích CV.",
  "settings.tab.positions": "Vị trí",
  "settings.tab.positionsSub": "Vị trí và bộ tiêu chí dùng khi phân tích CV.",
  "settings.tab.models": "AI models",
  "settings.tab.modelsSub": "Catalog model phân tích và trạng thái bật/tắt.",
  "settings.tab.providers": "Nhà cung cấp",
  "settings.tab.providersSub":
    "Base URL và API key cho provider AI và GitHub; API gateway đọc cấu hình này mỗi lần phân tích.",
  "settings.tab.stages": "Công đoạn",
  "settings.tab.stagesSub": "Các bước hiển thị trong luồng phân tích CV.",

  "settings.security.title": "Bảo mật & thông báo",
  "settings.security.saved": "Đã lưu thay đổi.",
  "settings.security.saving": "Đang lưu…",
  "settings.security.saveError": "Không lưu được thay đổi.",
  "settings.security.loading": "Đang tải cấu hình…",
  "settings.security.sectionSecurity": "Bảo mật",
  "settings.security.securityNote": "Áp dụng cho lần đăng nhập kế tiếp",
  "settings.security.twoFactor": "Xác thực hai lớp",
  "settings.security.twoFactorSub": "Yêu cầu mã OTP khi đăng nhập.",
  "settings.security.session": "Tự đăng xuất",
  "settings.security.sessionSub":
    "Đăng xuất khi không hoạt động quá thời gian này.",
  "settings.security.sessionAria": "Tự đăng xuất sau",
  "settings.security.sessionUnset": "Chưa đặt",
  "settings.security.hours": "{hours} giờ",
  "settings.security.sectionNotifications": "Thông báo",
  "settings.security.notificationsNote": "Gửi qua email nội bộ",
  "settings.security.notifyReview": "Nhắc hồ sơ chờ review",
  "settings.security.notifyReviewSub":
    "Nhắc reviewer khi hồ sơ chờ quá 24 giờ.",
  "settings.security.notifyDone": "Phân tích hoàn tất",
  "settings.security.notifyDoneSub":
    "Báo khi AI phân tích xong một hồ sơ.",
  "settings.security.notifyDigest": "Tóm tắt hàng tuần",
  "settings.security.notifyDigestSub":
    "Gửi email tổng hợp hoạt động tuyển dụng mỗi thứ Hai.",
  "settings.security.footnote":
    "Mỗi thay đổi được lưu ngay vào bảng workspace_settings và áp dụng cho toàn bộ workspace.",

  "settings.team.title": "Thành viên",
  "settings.team.meta": "{count} người · team_members",
  "settings.team.add": "Thêm thành viên",
  "settings.team.name": "Họ tên",
  "settings.team.namePlaceholder": "Nguyễn Văn A",
  "settings.team.email": "Email",
  "settings.team.emailPlaceholder": "ten@congty.vn",
  "settings.team.role": "Vai trò",
  "settings.team.loading": "Đang tải thành viên…",
  "settings.team.colMember": "Thành viên",
  "settings.team.colEmail": "Email",
  "settings.team.defaultRole": "Thành viên",
  "settings.team.created": "Đã thêm {name}.",
  "settings.team.updated": "Đã cập nhật {name}.",
  "settings.team.saveError": "Không lưu được thành viên.",
  "settings.team.deleted": "Đã xoá {name}.",
  "settings.team.deleteError": "Không xoá được.",
  "settings.team.confirm":
    "Xoá thành viên {name}? Hồ sơ đã gán người này vẫn giữ tên dạng văn bản.",
  "settings.team.editAria": "Sửa {name}",
  "settings.team.deleteAria": "Xoá {name}",
  "settings.team.footnote":
    "Ứng viên đang gán reviewer không bị thay đổi khi xoá thành viên; chỉ danh mục thành viên bị cập nhật.",

  "settings.levels.title": "Cấp bậc",
  "settings.levels.meta": "{count} cấp bậc · levels",
  "settings.levels.add": "Thêm cấp bậc",
  "settings.levels.name": "Tên cấp bậc",
  "settings.levels.namePlaceholder": "Ví dụ: Senior",
  "settings.levels.rank": "Thứ tự",
  "settings.levels.rankPlaceholder": "1",
  "settings.levels.loading": "Đang tải cấp bậc…",
  "settings.levels.colLevel": "Cấp bậc",
  "settings.levels.rankError": "Thứ tự phải là số nguyên.",
  "settings.levels.renamed":
    "Đã đổi {from} thành {to} và cập nhật vị trí, hồ sơ liên quan.",
  "settings.levels.updated": "Đã cập nhật cấp bậc {name}.",
  "settings.levels.added": "Đã thêm cấp bậc {name}.",
  "settings.levels.saveError": "Không lưu được cấp bậc.",
  "settings.levels.deleted": "Đã xoá cấp bậc {name}.",
  "settings.levels.deleteError": "Không xoá được cấp bậc.",
  "settings.levels.confirm":
    "Xoá cấp bậc {name}? Vị trí và hồ sơ đang mang cấp bậc này vẫn giữ nguyên giá trị.",
  "settings.levels.editAria": "Sửa {name}",
  "settings.levels.deleteAria": "Xoá {name}",
  "settings.levels.footnote":
    "Danh sách sắp theo thứ tự tăng dần. Đổi tên cấp bậc sẽ cập nhật luôn vị trí và hồ sơ ứng viên đang dùng tên cũ.",

  "settings.teams.title": "Chuyên môn",
  "settings.teams.meta": "{count} chuyên môn · teams",
  "settings.teams.add": "Thêm chuyên môn",
  "settings.teams.name": "Tên chuyên môn",
  "settings.teams.namePlaceholder": "Ví dụ: Backend",
  "settings.teams.rank": "Thứ tự",
  "settings.teams.rankPlaceholder": "1",
  "settings.teams.loading": "Đang tải chuyên môn…",
  "settings.teams.colTeam": "Chuyên môn",
  "settings.teams.rankError": "Thứ tự phải là số nguyên.",
  "settings.teams.renamed":
    "Đã đổi {from} thành {to} và cập nhật vị trí liên quan.",
  "settings.teams.updated": "Đã cập nhật chuyên môn {name}.",
  "settings.teams.added": "Đã thêm chuyên môn {name}.",
  "settings.teams.saveError": "Không lưu được chuyên môn.",
  "settings.teams.deleted": "Đã xoá chuyên môn {name}.",
  "settings.teams.deleteError": "Không xoá được chuyên môn.",
  "settings.teams.confirm":
    "Xoá chuyên môn {name}? Vị trí đang dùng tên này vẫn giữ nguyên giá trị.",
  "settings.teams.editAria": "Sửa {name}",
  "settings.teams.deleteAria": "Xoá {name}",
  "settings.teams.footnote":
    "Danh sách sắp theo thứ tự tăng dần. Đổi tên chuyên môn sẽ cập nhật luôn các vị trí đang dùng tên cũ.",
} as const;

const en: Record<keyof typeof vi, Message> = {
  "settings.tabsAria": "Settings tabs",
  "settings.saveChanges": "Save changes",
  "settings.actions": "Actions",
  "settings.page.info": "Showing {from}–{to} of {total}",
  "settings.page.prev": "Previous",
  "settings.page.next": "Next",

  "settings.tab.security": "Security & notifications",
  "settings.tab.securitySub":
    "Two-factor sign-in, auto sign-out and operational notifications.",
  "settings.tab.team": "Team",
  "settings.tab.teamSub":
    "Member directory used for reviewers and visibility permissions.",
  "settings.tab.levels": "Levels",
  "settings.tab.levelsSub":
    "Levels shared by positions, CV upload and profile analysis.",
  "settings.tab.teams": "Specializations",
  "settings.tab.teamsSub":
    "IT specialization catalog shared by positions and CV analysis.",
  "settings.tab.positions": "Positions",
  "settings.tab.positionsSub":
    "Positions and criteria sets used when analyzing CVs.",
  "settings.tab.models": "AI models",
  "settings.tab.modelsSub": "Analysis model catalog and on/off state.",
  "settings.tab.providers": "Providers",
  "settings.tab.providersSub":
    "Base URLs and API keys for AI providers and GitHub; the API gateway reads this on every analysis.",
  "settings.tab.stages": "Stages",
  "settings.tab.stagesSub": "Steps shown in the CV analysis flow.",

  "settings.security.title": "Security & notifications",
  "settings.security.saved": "Changes saved.",
  "settings.security.saving": "Saving…",
  "settings.security.saveError": "Couldn't save the changes.",
  "settings.security.loading": "Loading settings…",
  "settings.security.sectionSecurity": "Security",
  "settings.security.securityNote": "Applies to the next sign-in",
  "settings.security.twoFactor": "Two-factor authentication",
  "settings.security.twoFactorSub": "Require an OTP code when signing in.",
  "settings.security.session": "Auto sign-out",
  "settings.security.sessionSub":
    "Sign out after this period of inactivity.",
  "settings.security.sessionAria": "Auto sign-out after",
  "settings.security.sessionUnset": "Not set",
  "settings.security.hours": {
    one: "{hours} hour",
    other: "{hours} hours",
  },
  "settings.security.sectionNotifications": "Notifications",
  "settings.security.notificationsNote": "Sent by internal email",
  "settings.security.notifyReview": "Review reminders",
  "settings.security.notifyReviewSub":
    "Remind reviewers when a profile has been waiting over 24 hours.",
  "settings.security.notifyDone": "Analysis complete",
  "settings.security.notifyDoneSub":
    "Notify when AI finishes analyzing a profile.",
  "settings.security.notifyDigest": "Weekly digest",
  "settings.security.notifyDigestSub":
    "Email a summary of recruiting activity every Monday.",
  "settings.security.footnote":
    "Every change is saved immediately to workspace_settings and applies to the whole workspace.",

  "settings.team.title": "Team",
  "settings.team.meta": {
    one: "{count} member · team_members",
    other: "{count} members · team_members",
  },
  "settings.team.add": "Add member",
  "settings.team.name": "Full name",
  "settings.team.namePlaceholder": "Alex Nguyen",
  "settings.team.email": "Email",
  "settings.team.emailPlaceholder": "name@company.com",
  "settings.team.role": "Role",
  "settings.team.loading": "Loading team…",
  "settings.team.colMember": "Member",
  "settings.team.colEmail": "Email",
  "settings.team.defaultRole": "Member",
  "settings.team.created": "Added {name}.",
  "settings.team.updated": "Updated {name}.",
  "settings.team.saveError": "Couldn't save the member.",
  "settings.team.deleted": "Deleted {name}.",
  "settings.team.deleteError": "Couldn't delete the member.",
  "settings.team.confirm":
    "Delete member {name}? Profiles assigned to this person keep the name as text.",
  "settings.team.editAria": "Edit {name}",
  "settings.team.deleteAria": "Delete {name}",
  "settings.team.footnote":
    "Candidates assigned to a reviewer are unchanged when a member is deleted; only the member directory is updated.",

  "settings.levels.title": "Levels",
  "settings.levels.meta": {
    one: "{count} level · levels",
    other: "{count} levels · levels",
  },
  "settings.levels.add": "Add level",
  "settings.levels.name": "Level name",
  "settings.levels.namePlaceholder": "e.g. Senior",
  "settings.levels.rank": "Order",
  "settings.levels.rankPlaceholder": "1",
  "settings.levels.loading": "Loading levels…",
  "settings.levels.colLevel": "Level",
  "settings.levels.rankError": "Order must be a whole number.",
  "settings.levels.renamed":
    "Renamed {from} to {to} and updated related positions and profiles.",
  "settings.levels.updated": "Updated level {name}.",
  "settings.levels.added": "Added level {name}.",
  "settings.levels.saveError": "Couldn't save the level.",
  "settings.levels.deleted": "Deleted level {name}.",
  "settings.levels.deleteError": "Couldn't delete the level.",
  "settings.levels.confirm":
    "Delete level {name}? Positions and profiles using this level keep their current value.",
  "settings.levels.editAria": "Edit {name}",
  "settings.levels.deleteAria": "Delete {name}",
  "settings.levels.footnote":
    "The list is sorted by ascending order. Renaming a level also updates positions and candidate profiles that use the old name.",

  "settings.teams.title": "Specializations",
  "settings.teams.meta": {
    one: "{count} specialization · teams",
    other: "{count} specializations · teams",
  },
  "settings.teams.add": "Add specialization",
  "settings.teams.name": "Specialization name",
  "settings.teams.namePlaceholder": "e.g. Backend",
  "settings.teams.rank": "Order",
  "settings.teams.rankPlaceholder": "1",
  "settings.teams.loading": "Loading specializations…",
  "settings.teams.colTeam": "Specialization",
  "settings.teams.rankError": "Order must be a whole number.",
  "settings.teams.renamed":
    "Renamed {from} to {to} and updated related positions.",
  "settings.teams.updated": "Updated specialization {name}.",
  "settings.teams.added": "Added specialization {name}.",
  "settings.teams.saveError": "Couldn't save the specialization.",
  "settings.teams.deleted": "Deleted specialization {name}.",
  "settings.teams.deleteError": "Couldn't delete the specialization.",
  "settings.teams.confirm":
    "Delete specialization {name}? Positions using this name keep their current value.",
  "settings.teams.editAria": "Edit {name}",
  "settings.teams.deleteAria": "Delete {name}",
  "settings.teams.footnote":
    "The list is sorted by ascending order. Renaming a specialization also updates positions that use the old name.",
};

export const settingsMessages = { vi, en };
