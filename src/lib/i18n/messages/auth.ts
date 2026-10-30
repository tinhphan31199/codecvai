import type { Message } from "../types";

const vi = {
  "auth.title": "Đăng nhập CodeCV AI",
  "auth.subtitle":
    "Đánh giá ứng viên dựa trên bằng chứng, ngay trong workspace của bạn.",
  "auth.loginTab": "Đăng nhập",
  "auth.registerTab": "Đăng ký",
  "auth.username": "Tên đăng nhập",
  "auth.usernamePlaceholder": "vd: minhanh",
  "auth.usernameHint": "3–32 ký tự: chữ thường, số, dấu chấm, gạch dưới, gạch ngang.",
  "auth.password": "Mật khẩu",
  "auth.passwordHint": "Tối thiểu 8 ký tự.",
  "auth.displayName": "Tên hiển thị",
  "auth.displayNameHint": "Không bắt buộc, mặc định dùng tên đăng nhập.",
  "auth.submitLogin": "Đăng nhập",
  "auth.submitRegister": "Tạo tài khoản",
  "auth.busyLogin": "Đang đăng nhập…",
  "auth.busyRegister": "Đang tạo tài khoản…",
  "auth.loginError": "Không đăng nhập được. Vui lòng thử lại.",
  "auth.registerError": "Không tạo được tài khoản. Vui lòng thử lại.",
  "auth.googleError": "Không đăng nhập được bằng Google. Vui lòng thử lại.",
  "auth.googleLoadError":
    "Không tải được nút đăng nhập Google. Kiểm tra kết nối mạng rồi thử lại.",
  "auth.or": "hoặc",
  "auth.registerNote":
    "Đăng ký đang mở cho công cụ nội bộ: ai có liên kết đều có thể tạo tài khoản.",
  "auth.showPassword": "Hiện mật khẩu",
  "auth.hidePassword": "Ẩn mật khẩu",
  "auth.logout": "Đăng xuất",
  "auth.signedInAs": "Đang đăng nhập: {name}",
  "auth.sessionNote": "Phiên đăng nhập được lưu trên thiết bị này.",
  "auth.googleCreateNote":
    "Lần đăng nhập Google đầu tiên sẽ tự tạo tài khoản mới nếu email chưa có. Phiên đăng nhập được lưu trên thiết bị này.",
  "auth.bootLoading": "Đang kiểm tra phiên đăng nhập…",
} satisfies Record<string, Message>;

const en = {
  "auth.title": "Sign in to CodeCV AI",
  "auth.subtitle":
    "Evidence-based candidate review, right inside your workspace.",
  "auth.loginTab": "Sign in",
  "auth.registerTab": "Create account",
  "auth.username": "Username",
  "auth.usernamePlaceholder": "e.g. minhanh",
  "auth.usernameHint": "3–32 characters: lowercase letters, digits, dots, underscores, dashes.",
  "auth.password": "Password",
  "auth.passwordHint": "At least 8 characters.",
  "auth.displayName": "Display name",
  "auth.displayNameHint": "Optional, defaults to the username.",
  "auth.submitLogin": "Sign in",
  "auth.submitRegister": "Create account",
  "auth.busyLogin": "Signing in…",
  "auth.busyRegister": "Creating account…",
  "auth.loginError": "Couldn't sign in. Please try again.",
  "auth.registerError": "Couldn't create the account. Please try again.",
  "auth.googleError": "Couldn't sign in with Google. Please try again.",
  "auth.googleLoadError":
    "Couldn't load the Google sign-in button. Check your connection and try again.",
  "auth.or": "or",
  "auth.registerNote":
    "Registration is open for this internal tool: anyone with the link can create an account.",
  "auth.showPassword": "Show password",
  "auth.hidePassword": "Hide password",
  "auth.logout": "Sign out",
  "auth.signedInAs": "Signed in as {name}",
  "auth.sessionNote": "Your session is stored on this device.",
  "auth.googleCreateNote":
    "Your first Google sign-in creates an account automatically if the email is new. Your session is stored on this device.",
  "auth.bootLoading": "Checking your session…",
} satisfies Record<keyof typeof vi, Message>;

export const authMessages = { vi, en };
