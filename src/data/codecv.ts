import type { MessageKey } from "@/lib/i18n";

export type Screen =
  | "overview"
  | "upload"
  | "candidates"
  | "candidate"
  | "repository"
  | "interview"
  | "jobs"
  | "reports"
  | "settings";

export type CandidateStatus =
  | "completed"
  | "processing"
  | "review"
  | "failed"
  | "archived";

export type EvidenceState = "verified" | "inferred" | "missing";

export type Severity = "high" | "medium" | "low" | "info";

export type FindingState = "open" | "needs-check" | "confirmed" | "dismissed";

export type CriterionKind = "must" | "nice";

export interface Criterion {
  id: string;
  label: string;
  kind: CriterionKind;
  state: EvidenceState;
  evidence: number;
  note: string;
  sources: string[];
}

export interface Skill {
  name: string;
  level: "Thành thạo" | "Khá" | "Cơ bản" | "Chưa rõ";
  confidence: "Cao" | "Trung bình" | "Thấp";
  state: EvidenceState;
  source: string;
  evidence: number;
}

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  module: string;
  file: string;
  line: number;
  state: FindingState;
  rationale: string;
  verification: string;
  code: string;
  hitLine: number;
}

export interface Question {
  id: string;
  category: "Architecture" | "Database" | "Messaging" | "Security" | "Testing";
  difficulty: "Middle" | "Senior";
  text: string;
  answer: string;
  followUps: string[];
}

export interface HistoryEvent {
  at: string;
  title: string;
  detail: string;
  actor: string;
}

export interface Candidate {
  id: string;
  name: string;
  initials: string;
  hue: number;
  role: string;
  position: string;
  level: string;
  status: CandidateStatus;
  updated: string;
  updatedAt: string;
  email: string;
  phone: string;
  location: string;
  years: number;
  createdAt: string;
  source: string;
  reviewer?: string;
  summary: string;
  strengths: string[];
  verify: string[];
  criteria: Criterion[];
  skills?: Skill[];
  repo?: string;
  repoBranch?: string;
  commit?: string;
  repoState?: "connected" | "failed" | "none";
  findings?: Finding[];
  questions?: Question[];
  notes?: string;
  createdAtLabel?: string;
  stageIndex?: number;
}

export interface Position {
  id: string;
  title: string;
  team: string;
  level: string;
  open: string;
  candidates: number;
  candidateCount?: number;
  updated: string;
  owner: string;
  location: string;
  description: string;
  criteria: {
    label: string;
    kind: CriterionKind;
    weight: number;
    verify: string;
  }[];
}

export interface StageProgress {
  label: string;
  state: "done" | "current" | "pending" | "error";
  detail: string;
}

export const STAGES = [
  "Đọc tệp",
  "Trích xuất CV",
  "Đối chiếu JD",
  "Phân tích repository",
  "Sinh câu hỏi",
  "Hoàn tất",
] as const;

export const workspace = {
  name: "Product Engineering",
  total: 128,
  completed: 96,
  review: 12,
  processing: 4,
  failed: 4,
  archived: 12,
  positions: 8,
  updated: "26/10/2026 · 14:12",
  updatedAt: "26/10/2026 · 14:12",
  reviewer: "Minh Anh",
  analysisModel: "Gemini 3.5 Flash Lite",
};

console.assert(
  workspace.completed +
    workspace.review +
    workspace.processing +
    workspace.failed +
    workspace.archived ===
    workspace.total,
  "Workspace totals must reconcile.",
);

export const statusMeta: Record<
  CandidateStatus,
  { labelKey: MessageKey; className: string }
> = {
  completed: { labelKey: "status.completed", className: "pill-positive" },
  processing: { labelKey: "status.processing", className: "pill-info" },
  review: { labelKey: "status.review", className: "pill-warning" },
  failed: { labelKey: "status.failed", className: "pill-negative" },
  archived: { labelKey: "status.archived", className: "pill-neutral" },
};

export const evidenceMeta: Record<
  EvidenceState,
  { labelKey: MessageKey; shortKey: MessageKey; className: string }
> = {
  verified: {
    labelKey: "evidence.verified",
    shortKey: "evidence.verifiedShort",
    className: "pill-positive",
  },
  inferred: {
    labelKey: "evidence.inferred",
    shortKey: "evidence.inferredShort",
    className: "pill-info",
  },
  missing: {
    labelKey: "evidence.missing",
    shortKey: "evidence.missingShort",
    className: "pill-neutral",
  },
};

export const severityMeta: Record<
  Severity,
  { labelKey: MessageKey; className: string; rank: number }
> = {
  high: { labelKey: "severity.high", className: "sev-high", rank: 0 },
  medium: { labelKey: "severity.medium", className: "sev-medium", rank: 1 },
  low: { labelKey: "severity.low", className: "sev-low", rank: 2 },
  info: { labelKey: "severity.info", className: "sev-info", rank: 3 },
};

export const findingStateMeta: Record<
  FindingState,
  { labelKey: MessageKey; className: string }
> = {
  open: { labelKey: "finding.open", className: "pill-neutral" },
  "needs-check": { labelKey: "finding.needsCheck", className: "pill-warning" },
  confirmed: { labelKey: "finding.confirmed", className: "pill-positive" },
  dismissed: { labelKey: "finding.dismissed", className: "pill-neutral" },
};

const c = (
  id: string,
  label: string,
  kind: CriterionKind,
  state: EvidenceState,
  evidence: number,
  note: string,
  sources: string[],
): Criterion => ({ id, label, kind, state, evidence, note, sources });

const s = (
  name: string,
  level: Skill["level"],
  confidence: Skill["confidence"],
  state: EvidenceState,
  source: string,
  evidence: number,
): Skill => ({ name, level, confidence, state, source, evidence });

export function evidenceSummary(criteria: Criterion[]) {
  const verified = criteria.filter((x) => x.state === "verified").length;
  const inferred = criteria.filter((x) => x.state === "inferred").length;
  const missing = criteria.filter((x) => x.state === "missing").length;
  return {
    verified,
    inferred,
    missing,
    total: criteria.length,
    covered: verified + inferred,
    evidence: criteria.reduce((n, x) => n + x.evidence, 0),
  };
}

export function stageProgress(candidate: Candidate): StageProgress[] {
  if (candidate.status === "failed") {
    return STAGES.map((label, i) => ({
      label,
      state: i < 2 ? "done" : i === 2 ? "error" : "pending",
      detail:
        i === 2
          ? "Không truy cập được repository"
          : i < 2
            ? "Đã xong"
            : "Chưa chạy",
    }));
  }
  const current =
    candidate.status === "processing"
      ? (candidate.stageIndex ?? 0)
      : STAGES.length - 1;
  return STAGES.map((label, i) => ({
    label,
    state: i < current ? "done" : i === current ? "current" : "pending",
    detail:
      i < current
        ? "Đã xong"
        : i === current
          ? candidate.status === "processing"
            ? "Đang chạy"
            : "Đã xong"
          : "Chưa chạy",
  }));
}

export const positions: Position[] = [
  {
    id: "be-dotnet",
    title: "Senior .NET Backend",
    team: "Product Engineering",
    level: "Senior",
    open: "2 vị trí",
    candidates: 36,
    updated: "24/10/2026",
    owner: "Minh Anh",
    location: "TP.HCM · Hybrid",
    description:
      "Xây dựng dịch vụ đơn hàng và thanh toán cho nền tảng B2B, làm việc trực tiếp với team Platform và đảm nhận các quyết định kiến trúc trong domain order.",
    criteria: [
      {
        label: "5+ năm phát triển .NET / C#",
        kind: "must",
        weight: 5,
        verify: "CV · commit và pull request",
      },
      {
        label: "Thiết kế REST API và versioning",
        kind: "must",
        weight: 4,
        verify: "Repository · route và controller",
      },
      {
        label: "EF Core và PostgreSQL",
        kind: "must",
        weight: 4,
        verify: "Repository · migration và query",
      },
      {
        label: "Message broker (RabbitMQ)",
        kind: "must",
        weight: 4,
        verify: "Repository · consumer và publisher",
      },
      {
        label: "Kiểm thử tự động",
        kind: "must",
        weight: 3,
        verify: "Repository · test project và CI",
      },
      {
        label: "CI/CD và Docker",
        kind: "nice",
        weight: 2,
        verify: "Repository · Dockerfile và pipeline",
      },
      {
        label: "Thiết kế hệ thống phân tán",
        kind: "must",
        weight: 4,
        verify: "Phỏng vấn · câu hỏi kiến trúc",
      },
      {
        label: "Mentoring và review code",
        kind: "nice",
        weight: 2,
        verify: "Repository · review và comment",
      },
    ],
  },
  {
    id: "fullstack",
    title: "Full-stack Developer",
    team: "Growth",
    level: "Middle",
    open: "1 vị trí",
    candidates: 28,
    updated: "23/10/2026",
    owner: "Thu Trang",
    location: "TP.HCM · Hybrid",
    description:
      "Phát triển luồng thử nghiệm và onboarding cho khách hàng doanh nghiệp, từ API đến giao diện React.",
    criteria: [
      {
        label: "TypeScript và React",
        kind: "must",
        weight: 4,
        verify: "Repository · component",
      },
      {
        label: "Node.js hoặc .NET API",
        kind: "must",
        weight: 4,
        verify: "Repository · endpoint",
      },
      {
        label: "PostgreSQL và ORM",
        kind: "must",
        weight: 3,
        verify: "Repository · schema",
      },
      {
        label: "Kiểm thử tích hợp",
        kind: "must",
        weight: 3,
        verify: "Repository · test",
      },
      {
        label: "Observability",
        kind: "nice",
        weight: 2,
        verify: "Repository · logging",
      },
    ],
  },
  {
    id: "frontend",
    title: "Frontend Engineer (React)",
    team: "Product Engineering",
    level: "Middle",
    open: "1 vị trí",
    candidates: 22,
    updated: "22/10/2026",
    owner: "Minh Anh",
    location: "TP.HCM · Hybrid",
    description:
      "Xây dựng bề mặt sản phẩm cho recruiter, phối hợp chặt với design system và team backend.",
    criteria: [
      {
        label: "React và TypeScript",
        kind: "must",
        weight: 5,
        verify: "Repository · component",
      },
      {
        label: "Design system và accessibility",
        kind: "must",
        weight: 4,
        verify: "Repository · token và aria",
      },
      {
        label: "Kiểm thử component",
        kind: "must",
        weight: 3,
        verify: "Repository · test",
      },
      {
        label: "Hiệu năng và Core Web Vitals",
        kind: "nice",
        weight: 2,
        verify: "Phỏng vấn · ví dụ thực tế",
      },
      {
        label: "Quản lý state",
        kind: "must",
        weight: 3,
        verify: "Repository · store",
      },
    ],
  },
  {
    id: "devops",
    title: "DevOps Engineer",
    team: "Platform",
    level: "Senior",
    open: "1 vị trí",
    candidates: 18,
    updated: "21/10/2026",
    owner: "Quang Dũng",
    location: "TP.HCM · Remote",
    description:
      "Vận hành hạ tầng Kubernetes, pipeline triển khai và các tiêu chuẩn quan sát cho toàn bộ nền tảng.",
    criteria: [
      {
        label: "Kubernetes và container",
        kind: "must",
        weight: 5,
        verify: "CV · dự án vận hành",
      },
      {
        label: "Terraform / IaC",
        kind: "must",
        weight: 4,
        verify: "Repository · module",
      },
      {
        label: "CI/CD",
        kind: "must",
        weight: 4,
        verify: "Repository · pipeline",
      },
      {
        label: "Observability",
        kind: "must",
        weight: 3,
        verify: "Phỏng vấn · sự cố thực tế",
      },
      {
        label: "Bảo mật hạ tầng",
        kind: "nice",
        weight: 2,
        verify: "Phỏng vấn",
      },
    ],
  },
  {
    id: "data",
    title: "Data Engineer",
    team: "Insights",
    level: "Middle",
    open: "1 vị trí",
    candidates: 14,
    updated: "20/10/2026",
    owner: "Thu Trang",
    location: "Hà Nội · Hybrid",
    description:
      "Xây dựng pipeline dữ liệu tuyển dụng và các bảng tổng hợp phục vụ báo cáo chất lượng tuyển dụng.",
    criteria: [
      {
        label: "SQL và mô hình dữ liệu",
        kind: "must",
        weight: 5,
        verify: "CV · dự án",
      },
      {
        label: "Python và orchestration",
        kind: "must",
        weight: 4,
        verify: "Repository · DAG",
      },
      {
        label: "Chất lượng dữ liệu",
        kind: "must",
        weight: 3,
        verify: "Phỏng vấn",
      },
      {
        label: "Streaming",
        kind: "nice",
        weight: 2,
        verify: "Repository · consumer",
      },
    ],
  },
  {
    id: "mobile",
    title: "Mobile Engineer (Flutter)",
    team: "Product Engineering",
    level: "Junior",
    open: "1 vị trí",
    candidates: 4,
    updated: "19/10/2026",
    owner: "Minh Anh",
    location: "TP.HCM · Hybrid",
    description:
      "Phát triển ứng dụng di động cho ứng viên theo dõi trạng thái hồ sơ và lịch phỏng vấn.",
    criteria: [
      {
        label: "Dart và Flutter",
        kind: "must",
        weight: 5,
        verify: "Repository · app",
      },
      {
        label: "State management",
        kind: "must",
        weight: 3,
        verify: "Repository",
      },
      {
        label: "Kiểm thử widget",
        kind: "nice",
        weight: 2,
        verify: "Repository · test",
      },
    ],
  },
  {
    id: "solutions",
    title: "Solutions Architect",
    team: "Enterprise",
    level: "Senior",
    open: "1 vị trí",
    candidates: 3,
    updated: "18/10/2026",
    owner: "Quang Dũng",
    location: "TP.HCM · Hybrid",
    description:
      "Thiết kế giải pháp tích hợp cho khách hàng doanh nghiệp và dẫn dắt các buổi review kiến trúc.",
    criteria: [
      {
        label: "Thiết kế hệ thống",
        kind: "must",
        weight: 5,
        verify: "CV · dự án",
      },
      {
        label: "Giao tiếp với khách hàng",
        kind: "must",
        weight: 4,
        verify: "Phỏng vấn",
      },
      {
        label: "Bảo mật và tuân thủ",
        kind: "must",
        weight: 3,
        verify: "Phỏng vấn",
      },
    ],
  },
  {
    id: "qa",
    title: "QA Automation Engineer",
    team: "Product Engineering",
    level: "Middle",
    open: "1 vị trí",
    candidates: 3,
    updated: "17/10/2026",
    owner: "Thu Trang",
    location: "Đà Nẵng · Remote",
    description:
      "Xây dựng bộ kiểm thử tự động cho luồng phân tích CV và báo cáo ứng viên.",
    criteria: [
      {
        label: "Playwright / Cypress",
        kind: "must",
        weight: 4,
        verify: "Repository · test",
      },
      {
        label: "API testing",
        kind: "must",
        weight: 4,
        verify: "Repository · test",
      },
      {
        label: "CI và flaky test",
        kind: "nice",
        weight: 2,
        verify: "Phỏng vấn",
      },
    ],
  },
];

export const candidates: Candidate[] = [
  {
    id: "an",
    name: "Nguyễn Văn An",
    initials: "NA",
    hue: 243,
    role: "Senior .NET Backend",
    position: "Senior .NET Backend",
    level: "Senior",
    status: "completed",
    updated: "26/10 · 14:12",
    updatedAt: "26/10/2026 · 14:12",
    email: "an.nguyen@gmail.com",
    phone: "090 312 4481",
    location: "Thủ Đức, TP.HCM",
    years: 7,
    createdAt: "24/10/2026 · 09:05",
    source: "CV + 2 repository",
    reviewer: "Minh Anh",
    summary:
      "Backend engineer 7 năm với .NET, tập trung vào domain đơn hàng và thanh toán. Repository gần nhất cho thấy kinh nghiệm thực tế với EF Core, RabbitMQ và kiểm thử tích hợp; phần thiết kế phân tán cần xác minh thêm trong buổi phỏng vấn.",
    strengths: [
      "Thiết kế API và mô hình domain rõ ràng trong Orders.Api: 6 endpoint, 9 handler.",
      "Có kiểm thử tự động cho luồng tạo đơn và consumer; coverage 68% theo báo cáo CI.",
      "Đã review pull request cho 2 thành viên và xử lý migration EF Core trong môi trường nhiều phiên bản.",
    ],
    verify: [
      "Cơ chế idempotency của RabbitMQ consumer chưa được thể hiện trong code.",
      "Thiết kế hệ thống phân tán chưa có bằng chứng trực tiếp trong CV hoặc repository.",
      "Pipeline CI mới dừng ở build, chưa thấy bước deploy.",
    ],
    criteria: [
      c(
        "c1",
        "5+ năm phát triển .NET / C#",
        "must",
        "verified",
        3,
        "2019–2026 tại 2 công ty; commit C# trong 3 repository.",
        ["CV · Kinh nghiệm", "Git · 3 repository"],
      ),
      c(
        "c2",
        "Thiết kế REST API và versioning",
        "must",
        "verified",
        2,
        "Orders.Api có 6 endpoint, route v1/v2 và response envelope thống nhất.",
        ["Git · Orders.Api/Controllers"],
      ),
      c(
        "c3",
        "EF Core và PostgreSQL",
        "must",
        "verified",
        2,
        "4 entity, migration và transaction trong OrderRepository.",
        ["Git · Orders.Infrastructure"],
      ),
      c(
        "c4",
        "Message broker (RabbitMQ)",
        "must",
        "inferred",
        1,
        "Có consumer và publisher; chưa thấy retry, idempotency hoặc dead-letter.",
        ["Git · Messaging"],
      ),
      c(
        "c5",
        "Kiểm thử tự động",
        "must",
        "verified",
        2,
        "12 test cho handler và consumer; coverage 68% trong CI.",
        ["Git · tests", "CI · báo cáo coverage"],
      ),
      c(
        "c6",
        "CI/CD và Docker",
        "nice",
        "inferred",
        1,
        "Dockerfile có; pipeline chỉ thấy build, chưa thấy bước deploy.",
        ["Git · Dockerfile", "CI · pipeline"],
      ),
      c(
        "c7",
        "Thiết kế hệ thống phân tán",
        "must",
        "missing",
        0,
        "Không đủ dữ liệu trong CV và repository.",
        [],
      ),
      c(
        "c8",
        "Mentoring và review code",
        "nice",
        "verified",
        1,
        "Pull request review cho 2 thành viên trong 6 tháng gần nhất.",
        ["Git · pull request"],
      ),
    ],
    skills: [
      s("C# / .NET", "Thành thạo", "Cao", "verified", "CV + repository", 6),
      s("ASP.NET Core", "Thành thạo", "Cao", "verified", "Orders.Api", 4),
      s("EF Core", "Thành thạo", "Cao", "verified", "Orders.Infrastructure", 3),
      s("RabbitMQ", "Khá", "Trung bình", "inferred", "Messaging", 1),
      s("PostgreSQL", "Thành thạo", "Cao", "verified", "Migration + query", 3),
      s("Kiểm thử tích hợp", "Khá", "Trung bình", "inferred", "Tests", 2),
      s(
        "Thiết kế phân tán",
        "Chưa rõ",
        "Thấp",
        "missing",
        "Không đủ dữ liệu",
        0,
      ),
    ],
    repo: "vanan-dev/order-service",
    repoBranch: "main",
    commit: "a91f3c2",
    repoState: "connected",
    findings: [
      {
        id: "f1",
        severity: "high",
        title: "Consumer RabbitMQ chưa idempotent",
        module: "Messaging",
        file: "src/Orders.Infrastructure/Messaging/RabbitMqConsumer.cs",
        line: 48,
        state: "needs-check",
        rationale:
          "Handler lưu đơn trước khi ack và không có khoá theo message id. Với at-least-once, một lần redelivery có thể tạo đơn trùng.",
        verification:
          "Gửi cùng một message id hai lần vào queue thử nghiệm; kiểm tra số bản ghi order và unique index trên mã đơn.",
        code: `public async Task HandleAsync(OrderCreated message, CancellationToken ct)
{
    var order = new Order(message.OrderCode, message.CustomerId);
    _db.Orders.Add(order);
    await _db.SaveChangesAsync(ct);
    await _channel.BasicAckAsync(message.DeliveryTag, false, ct);
}`,
        hitLine: 6,
      },
      {
        id: "f2",
        severity: "high",
        title: "Thiếu unique index cho mã đơn hàng",
        module: "Persistence",
        file: "src/Orders.Infrastructure/Persistence/OrderRepository.cs",
        line: 31,
        state: "open",
        rationale:
          "Kiểm tra trùng mã đơn nằm ở tầng application; hai request đồng thời vẫn có thể cùng vượt qua kiểm tra trước khi ghi.",
        verification:
          "Chạy hai request tạo đơn song song với cùng OrderCode; kiểm tra số bản ghi và lỗi unique.",
        code: `var exists = await _db.Orders.AnyAsync(o => o.Code == code, ct);
if (exists) throw new DuplicateOrderException(code);

_db.Orders.Add(order);
await _db.SaveChangesAsync(ct);`,
        hitLine: 3,
      },
      {
        id: "f3",
        severity: "medium",
        title: "Retry không có backoff",
        module: "Messaging",
        file: "src/Orders.Infrastructure/Messaging/RabbitMqConsumer.cs",
        line: 81,
        state: "open",
        rationale:
          "Vòng retry hiện tại chạy lại ngay lập tức khi broker hoặc database tạm thời không sẵn sàng, làm tăng tải trong lúc sự cố.",
        verification:
          "Dừng PostgreSQL trong 30 giây, quan sát số lần retry và thời điểm message được xử lý lại.",
        code: `catch (Exception ex)
{
    _logger.LogError(ex, "Xử lý đơn thất bại");
    await _channel.BasicNackAsync(message.DeliveryTag, false, requeue: true);
}`,
        hitLine: 4,
      },
      {
        id: "f4",
        severity: "medium",
        title: "Thiếu test cho luồng huỷ đơn",
        module: "Testing",
        file: "tests/Orders.Tests/",
        line: 1,
        state: "open",
        rationale:
          "Có test cho tạo đơn nhưng không có test cho huỷ đơn và hoàn tiền, hai nhánh có thay đổi trạng thái quan trọng.",
        verification:
          "Đối chiếu danh sách test với các nhánh trạng thái trong OrderStatus; thêm test cho Cancelled và Refunded.",
        code: `[Fact]
public async Task CreateOrder_PersistsOrder()
{
    // 12 test hiện có tập trung vào luồng tạo đơn.
}`,
        hitLine: 2,
      },
      {
        id: "f5",
        severity: "low",
        title: "Log chứa email khách hàng",
        module: "Security",
        file: "src/Orders.Api/Controllers/OrdersController.cs",
        line: 64,
        state: "needs-check",
        rationale:
          "Email khách hàng xuất hiện trong log ở mức Information; cần kiểm tra nơi lưu log và thời gian lưu trữ.",
        verification:
          "Kiểm tra cấu hình log sink và thử tạo đơn với email giả; xác nhận không có PII trong log.",
        code: `_logger.LogInformation(
    "Tạo đơn {Code} cho khách {Email}",
    order.Code,
    order.CustomerEmail);`,
        hitLine: 3,
      },
      {
        id: "f6",
        severity: "low",
        title: "DTO dùng chung giữa API và worker",
        module: "Architecture",
        file: "src/Orders.Application/Contracts/OrderCreated.cs",
        line: 8,
        state: "open",
        rationale:
          "Cùng một DTO được dùng cho HTTP response và message payload, khiến thay đổi API ảnh hưởng đến worker.",
        verification:
          "Theo dõi các thay đổi gần đây của DTO và xem có consumer nào phụ thuộc vào field HTTP-only.",
        code: `public sealed record OrderCreated(
    string OrderCode,
    Guid CustomerId,
    string CustomerEmail,
    decimal Total);`,
        hitLine: 1,
      },
    ],
    questions: [
      {
        id: "q1",
        category: "Messaging",
        difficulty: "Senior",
        text: "Làm thế nào để consumer RabbitMQ trong repository này trở nên idempotent?",
        answer:
          "Lưu message id vào bảng processed_messages trong cùng transaction với nghiệp vụ, đặt unique index trên message id, chỉ ack sau khi commit và coi redelivery là trạng thái bình thường của at-least-once. Với side effect bên ngoài, dùng outbox để publish sau commit.",
        followUps: [
          "Nếu message đến trước khi transaction commit thì bạn xử lý thế nào?",
          "Bạn sẽ kiểm chứng idempotency bằng test nào?",
        ],
      },
      {
        id: "q2",
        category: "Architecture",
        difficulty: "Senior",
        text: "Vì sao tách Orders.Api và Orders.Application? Bạn sẽ thay đổi gì nếu có thêm worker?",
        answer:
          "Tách để domain và use case không phụ thuộc vào transport. Khi thêm worker, giữ nguyên Application và thêm adapter cho queue; nếu worker chỉ đọc, tách read model để tránh chia sẻ DbContext.",
        followUps: ["Bạn đặt transaction boundary ở đâu?"],
      },
      {
        id: "q3",
        category: "Architecture",
        difficulty: "Senior",
        text: "Luồng tạo đơn đang gọi trực tiếp payment gateway. Bạn sẽ đặt outbox ở đâu?",
        answer:
          "Ghi payment intent và outbox record trong cùng transaction; một publisher riêng đọc outbox và gọi gateway, sau đó cập nhật trạng thái. Không gọi gateway bên trong transaction của database.",
        followUps: ["Bạn xử lý callback đến trước khi outbox publish?"],
      },
      {
        id: "q4",
        category: "Architecture",
        difficulty: "Senior",
        text: "Repository dùng transaction EF Core. Bạn xử lý failure sau khi đã gửi message thế nào?",
        answer:
          "Không gửi message trước commit. Dùng outbox hoặc transactional messaging, và đảm bảo consumer có thể xử lý duplicate. Nếu buộc phải gửi trước, cần compensation và theo dõi trạng thái.",
        followUps: ["Bạn chọn exactly-once hay at-least-once? Vì sao?"],
      },
      {
        id: "q5",
        category: "Database",
        difficulty: "Senior",
        text: "Unique index nào cần thêm để tránh trùng mã đơn?",
        answer:
          "Unique index trên (tenant_id, order_code) nếu mã đơn chỉ unique trong tenant. Cần xử lý lỗi unique ở tầng application và trả về kết quả idempotent nếu request lặp.",
        followUps: ["Bạn có cần index cho soft-deleted order không?"],
      },
      {
        id: "q6",
        category: "Database",
        difficulty: "Senior",
        text: "Bạn chọn optimistic hay pessimistic concurrency cho tồn kho? Vì sao?",
        answer:
          "Optimistic với row version khi xung đột thấp; pessimistic khi tranh chấp cao và cần giữ chỗ ngay. Quyết định dựa trên tần suất xung đột và yêu cầu trải nghiệm.",
        followUps: ["Bạn đo xung đột bằng gì?"],
      },
      {
        id: "q7",
        category: "Database",
        difficulty: "Senior",
        text: "Query nào trong Orders.Api có nguy cơ N+1? Bạn sẽ kiểm chứng thế nào?",
        answer:
          "Các query lấy order kèm items qua navigation property. Kiểm chứng bằng log SQL và số round-trip; dùng Include hoặc projection có chủ đích.",
        followUps: ["Projection nào bạn chọn cho danh sách order?"],
      },
      {
        id: "q8",
        category: "Messaging",
        difficulty: "Senior",
        text: "RabbitMQ đang dùng at-least-once. Điều đó thay đổi thiết kế consumer thế nào?",
        answer:
          "Consumer phải idempotent, ack sau khi xử lý xong, và có dead-letter cho message lỗi. Không dựa vào thứ tự tuyệt đối giữa các message.",
        followUps: ["Bạn xử lý message đến sai thứ tự thế nào?"],
      },
      {
        id: "q9",
        category: "Messaging",
        difficulty: "Senior",
        text: "Bạn xử lý poison message và dead-letter queue ra sao?",
        answer:
          "Đặt giới hạn retry, chuyển message lỗi sang DLQ kèm lý do, có dashboard và quy trình replay. Không requeue vô hạn.",
        followUps: ["Ai chịu trách nhiệm replay DLQ?"],
      },
      {
        id: "q10",
        category: "Messaging",
        difficulty: "Senior",
        text: "Làm sao đảm bảo message được publish sau khi transaction commit?",
        answer:
          "Dùng outbox: ghi message vào bảng outbox trong cùng transaction, publisher riêng đọc và publish, đánh dấu đã gửi. Consumer vẫn phải idempotent.",
        followUps: ["Bạn xử lý outbox bị kẹt?"],
      },
      {
        id: "q11",
        category: "Security",
        difficulty: "Senior",
        text: "Log đang ghi email khách hàng. Bạn sẽ thay đổi gì?",
        answer:
          "Mask hoặc bỏ PII khỏi log, thêm cấu hình log level và retention, kiểm tra sink. Có thể dùng mã tham chiếu thay cho email.",
        followUps: ["Bạn phát hiện PII trong log cũ thế nào?"],
      },
      {
        id: "q12",
        category: "Security",
        difficulty: "Senior",
        text: "Bạn bảo vệ endpoint tạo đơn khỏi replay request thế nào?",
        answer:
          "Dùng idempotency key do client gửi, lưu kết quả theo key trong thời gian hợp lý, xác thực và giới hạn tần suất. Trả lại cùng kết quả cho request lặp.",
        followUps: ["Bạn chọn thời gian lưu key bao lâu?"],
      },
      {
        id: "q13",
        category: "Testing",
        difficulty: "Senior",
        text: "Bạn viết test nào để chứng minh consumer idempotent?",
        answer:
          "Test gửi cùng message id hai lần, khẳng định chỉ có một order và một processed_message. Thêm test race condition với hai consumer song song.",
        followUps: ["Bạn chạy test này ở CI hay môi trường tích hợp?"],
      },
      {
        id: "q14",
        category: "Testing",
        difficulty: "Senior",
        text: "Coverage 68%, bạn ưu tiên thêm test ở đâu trước?",
        answer:
          "Ưu tiên các nhánh thay đổi trạng thái và tiền: tạo, huỷ, hoàn tiền, xử lý message lỗi. Coverage chỉ là chỉ báo, không phải mục tiêu.",
        followUps: ["Bạn đo test nào thực sự bắt được lỗi?"],
      },
      {
        id: "q15",
        category: "Testing",
        difficulty: "Senior",
        text: "Bạn kiểm thử race condition giữa hai worker thế nào?",
        answer:
          "Dùng test tích hợp với hai consumer, barrier để đảm bảo chúng xử lý cùng lúc, và khẳng định unique constraint hoặc khoá phân tán hoạt động.",
        followUps: ["Bạn sẽ giả lập broker redelivery ra sao?"],
      },
    ],
  },
  {
    id: "binh",
    name: "Trần Thị Bình",
    initials: "TB",
    hue: 170,
    role: "Full-stack Developer",
    position: "Full-stack Developer",
    level: "Middle",
    status: "processing",
    updated: "26/10 · 14:05",
    updatedAt: "26/10/2026 · 14:05",
    email: "binh.tran@gmail.com",
    phone: "091 884 2205",
    location: "Quận 3, TP.HCM",
    years: 4,
    createdAt: "26/10/2026 · 13:58",
    source: "CV + GitHub",
    summary:
      "Đang trích xuất thông tin từ CV và đối chiếu với vị trí Full-stack Developer.",
    strengths: ["4 năm TypeScript và React", "Có kinh nghiệm Node.js API"],
    verify: [
      "Repository chưa được phân tích xong",
      "Chưa đối chiếu đủ tiêu chí JD",
    ],
    criteria: [
      c(
        "b1",
        "TypeScript và React",
        "must",
        "inferred",
        1,
        "Đang trích xuất từ CV.",
        ["CV"],
      ),
      c(
        "b2",
        "Node.js hoặc .NET API",
        "must",
        "inferred",
        1,
        "Đang trích xuất từ CV.",
        ["CV"],
      ),
      c(
        "b3",
        "PostgreSQL và ORM",
        "must",
        "missing",
        0,
        "Chưa có dữ liệu.",
        [],
      ),
      c(
        "b4",
        "Kiểm thử tích hợp",
        "must",
        "missing",
        0,
        "Chưa có dữ liệu.",
        [],
      ),
      c("b5", "Observability", "nice", "missing", 0, "Chưa có dữ liệu.", []),
    ],
    stageIndex: 2,
  },
  {
    id: "minh",
    name: "Lê Hoàng Minh",
    initials: "LM",
    hue: 28,
    role: "Senior .NET Backend",
    position: "Senior .NET Backend",
    level: "Senior",
    status: "review",
    updated: "26/10 · 09:20",
    updatedAt: "26/10/2026 · 09:20",
    email: "minh.le@gmail.com",
    phone: "093 771 6082",
    location: "Bình Thạnh, TP.HCM",
    years: 8,
    createdAt: "25/10/2026 · 16:10",
    source: "CV + 1 repository",
    reviewer: "Minh Anh",
    summary:
      "Backend engineer 8 năm, kinh nghiệm payment gateway và tích hợp ngân hàng. Repository payment-gateway có cấu trúc tốt nhưng phần webhook cần xác minh chữ ký và idempotency trước khi kết luận.",
    strengths: [
      "Thiết kế webhook và retry rõ ràng, có test cho callback thành công.",
      "Kinh nghiệm vận hành payment gateway với lưu lượng lớn trong CV.",
      "Có kinh nghiệm mentoring và review kiến trúc.",
    ],
    verify: [
      "Webhook chưa thấy verify signature trong code.",
      "Idempotency-Key chưa được lưu hoặc kiểm tra.",
      "Secret đang nằm trong appsettings.Development.json.",
    ],
    criteria: [
      c(
        "m1",
        "5+ năm phát triển .NET / C#",
        "must",
        "verified",
        3,
        "8 năm kinh nghiệm; 2 công ty thanh toán.",
        ["CV · Kinh nghiệm"],
      ),
      c(
        "m2",
        "Thiết kế REST API và versioning",
        "must",
        "verified",
        2,
        "API v1/v2 và tài liệu OpenAPI.",
        ["Git · API"],
      ),
      c(
        "m3",
        "EF Core và PostgreSQL",
        "must",
        "verified",
        2,
        "Migration và repository cho payment intent.",
        ["Git · Persistence"],
      ),
      c(
        "m4",
        "Message broker (RabbitMQ)",
        "must",
        "verified",
        2,
        "Publisher cho webhook event và consumer retry.",
        ["Git · Messaging"],
      ),
      c(
        "m5",
        "Kiểm thử tự động",
        "must",
        "verified",
        2,
        "18 test; có test callback.",
        ["Git · tests"],
      ),
      c(
        "m6",
        "CI/CD và Docker",
        "nice",
        "inferred",
        1,
        "Có Dockerfile; chưa thấy deploy.",
        ["Git · Dockerfile"],
      ),
      c(
        "m7",
        "Thiết kế hệ thống phân tán",
        "must",
        "inferred",
        1,
        "Có retry và webhook; chưa thấy outbox.",
        ["Git · Messaging"],
      ),
      c(
        "m8",
        "Mentoring và review code",
        "nice",
        "verified",
        1,
        "Review cho 3 thành viên.",
        ["Git · pull request"],
      ),
    ],
    skills: [
      s("C# / .NET", "Thành thạo", "Cao", "verified", "CV + repository", 7),
      s(
        "Payment gateway",
        "Thành thạo",
        "Cao",
        "verified",
        "CV + repository",
        4,
      ),
      s("RabbitMQ", "Thành thạo", "Cao", "verified", "Messaging", 3),
      s("Webhook security", "Khá", "Trung bình", "inferred", "Repository", 1),
      s("Thiết kế phân tán", "Khá", "Trung bình", "inferred", "Repository", 1),
    ],
    repo: "minhle/payment-gateway",
    repoBranch: "main",
    commit: "b47e0d1",
    repoState: "connected",
    findings: [
      {
        id: "m-f1",
        severity: "high",
        title: "Webhook chưa verify chữ ký",
        module: "Security",
        file: "src/Payment.Api/Controllers/WebhookController.cs",
        line: 22,
        state: "needs-check",
        rationale:
          "Endpoint nhận payload nhưng chưa thấy kiểm tra HMAC trước khi cập nhật trạng thái.",
        verification:
          "Gửi payload sai chữ ký và xác nhận endpoint trả 401; kiểm tra secret được nạp từ đâu.",
        code: `[HttpPost("webhook")]
public async Task<IActionResult> Receive([FromBody] JsonElement payload)
{
    await _handler.HandleAsync(payload);
    return Ok();
}`,
        hitLine: 4,
      },
      {
        id: "m-f2",
        severity: "high",
        title: "Idempotency-Key chưa được lưu",
        module: "Architecture",
        file: "src/Payment.Application/Payments/CreatePaymentHandler.cs",
        line: 34,
        state: "open",
        rationale:
          "Handler nhận header nhưng không lưu kết quả, nên retry từ client tạo payment mới.",
        verification:
          "Gọi cùng Idempotency-Key hai lần và so sánh payment id trả về.",
        code: `var payment = new Payment(request.Amount, request.Currency);
await _gateway.CreateAsync(payment);
await _db.SaveChangesAsync();`,
        hitLine: 2,
      },
      {
        id: "m-f3",
        severity: "medium",
        title: "Secret trong appsettings.Development.json",
        module: "Security",
        file: "src/Payment.Api/appsettings.Development.json",
        line: 9,
        state: "confirmed",
        rationale:
          "File cấu hình development chứa secret thật; cần chuyển sang user-secrets hoặc vault.",
        verification: "Kiểm tra lịch sử Git và xoay secret nếu đã commit.",
        code: `"PaymentGateway": {
  "ApiKey": "sk_test_51N...",
  "WebhookSecret": "whsec_9f..."
}`,
        hitLine: 2,
      },
      {
        id: "m-f4",
        severity: "medium",
        title: "Retry webhook không backoff",
        module: "Messaging",
        file: "src/Payment.Infrastructure/Webhooks/WebhookDispatcher.cs",
        line: 58,
        state: "open",
        rationale:
          "Dispatcher thử lại ngay sau lỗi, không giãn thời gian và không có DLQ.",
        verification: "Tắt endpoint nhận và quan sát số lần gọi trong 10 giây.",
        code: `for (var i = 0; i < 3; i++)
{
    var ok = await SendAsync(payload);
    if (ok) return;
}`,
        hitLine: 5,
      },
    ],
    questions: [
      {
        id: "m-q1",
        category: "Security",
        difficulty: "Senior",
        text: "Bạn bảo vệ webhook thanh toán khỏi request giả mạo thế nào?",
        answer:
          "Xác minh HMAC trên raw body, so sánh constant-time, từ chối timestamp cũ và lưu event id để chống replay. Secret nằm trong vault, xoay định kỳ.",
        followUps: ["Bạn xử lý webhook đến trước khi giao dịch được lưu?"],
      },
      {
        id: "m-q2",
        category: "Architecture",
        difficulty: "Senior",
        text: "Idempotency-Key nên được lưu ở đâu và trong bao lâu?",
        answer:
          "Lưu cạnh payment record hoặc bảng riêng với unique key, kèm response đã trả. Thời gian lưu phụ thuộc cửa sổ retry của client, thường 24 giờ đến 7 ngày.",
        followUps: ["Bạn trả lại kết quả gì cho request lặp?"],
      },
    ],
  },
  {
    id: "ha",
    name: "Phạm Thu Hà",
    initials: "TH",
    hue: 152,
    role: "Frontend Engineer",
    position: "Frontend Engineer (React)",
    level: "Middle",
    status: "completed",
    updated: "26/10 · 12:40",
    updatedAt: "26/10/2026 · 12:40",
    email: "ha.pham@gmail.com",
    phone: "097 220 4710",
    location: "Quận 1, TP.HCM",
    years: 5,
    createdAt: "25/10/2026 · 14:22",
    source: "CV + 1 repository",
    reviewer: "Thu Trang",
    summary:
      "Frontend engineer 5 năm với React và TypeScript. Repository design-system cho thấy kinh nghiệm xây component, accessibility và test; hiệu năng trên màn hình lớn chưa có bằng chứng.",
    strengths: [
      "Xây design system với 34 component và token rõ ràng.",
      "Có test component và kiểm tra accessibility bằng axe.",
      "Kinh nghiệm phối hợp với designer trong CV.",
    ],
    verify: [
      "Hiệu năng và Core Web Vitals chưa có bằng chứng.",
      "Chưa thấy kinh nghiệm với SSR.",
    ],
    criteria: [
      c(
        "h1",
        "React và TypeScript",
        "must",
        "verified",
        3,
        "5 năm; component trong design-system.",
        ["CV", "Git · components"],
      ),
      c(
        "h2",
        "Design system và accessibility",
        "must",
        "verified",
        2,
        "Token, storybook và axe.",
        ["Git · tokens"],
      ),
      c(
        "h3",
        "Kiểm thử component",
        "must",
        "verified",
        2,
        "24 test component.",
        ["Git · tests"],
      ),
      c(
        "h4",
        "Hiệu năng và Core Web Vitals",
        "nice",
        "missing",
        0,
        "Không đủ dữ liệu.",
        [],
      ),
      c(
        "h5",
        "Quản lý state",
        "must",
        "inferred",
        1,
        "Dùng Context; chưa thấy state phức tạp.",
        ["Git · store"],
      ),
      c(
        "h6",
        "SSR / Next.js",
        "nice",
        "inferred",
        1,
        "Có cấu hình Next.js nhưng chưa thấy dữ liệu.",
        ["Git · config"],
      ),
    ],
    repo: "thuha/design-system",
    repoBranch: "main",
    commit: "c12d9a4",
    repoState: "connected",
    findings: [
      {
        id: "h-f1",
        severity: "low",
        title: "Thiếu kiểm thử cho keyboard navigation",
        module: "Accessibility",
        file: "src/components/Dialog/Dialog.test.tsx",
        line: 18,
        state: "open",
        rationale: "Có test axe nhưng chưa có test focus trap và phím Escape.",
        verification:
          "Chạy test với bàn phím và kiểm tra focus khi đóng dialog.",
        code: `it("renders the dialog", () => {
  render(<Dialog open>...</Dialog>);
  expect(screen.getByRole("dialog")).toBeVisible();
});`,
        hitLine: 3,
      },
      {
        id: "h-f2",
        severity: "medium",
        title: "Bundle chưa tách theo route",
        module: "Performance",
        file: "src/app/layout.tsx",
        line: 12,
        state: "needs-check",
        rationale:
          "Toàn bộ component được import trực tiếp; cần kiểm tra bundle size trước khi kết luận.",
        verification:
          "Chạy build và đọc báo cáo bundle; thử dynamic import cho route settings.",
        code: `import { SettingsPanel } from "@/components/settings";
import { ReportsPanel } from "@/components/reports";`,
        hitLine: 2,
      },
    ],
  },
  {
    id: "huy",
    name: "Võ Quốc Huy",
    initials: "QH",
    hue: 212,
    role: "DevOps Engineer",
    position: "DevOps Engineer",
    level: "Senior",
    status: "failed",
    updated: "26/10 · 10:50",
    updatedAt: "26/10/2026 · 10:50",
    email: "huy.vo@gmail.com",
    phone: "090 662 1184",
    location: "Thủ Đức, TP.HCM",
    years: 6,
    createdAt: "25/10/2026 · 18:44",
    source: "CV + repository (lỗi)",
    summary:
      "CV cho thấy 6 năm vận hành Kubernetes và CI/CD. Repository riêng tư không truy cập được nên phần lớn tiêu chí kỹ thuật chưa thể xác minh.",
    strengths: [
      "Kinh nghiệm Kubernetes và Terraform trong CV.",
      "Từng vận hành hệ thống 50+ service.",
    ],
    verify: [
      "Repository không truy cập được.",
      "Chưa xác minh observability và bảo mật hạ tầng.",
    ],
    criteria: [
      c(
        "q1",
        "Kubernetes và container",
        "must",
        "verified",
        2,
        "CV mô tả 4 năm vận hành.",
        ["CV"],
      ),
      c(
        "q2",
        "Terraform / IaC",
        "must",
        "inferred",
        1,
        "CV đề cập; chưa có repository.",
        ["CV"],
      ),
      c("q3", "CI/CD", "must", "verified", 2, "CV có pipeline GitLab.", ["CV"]),
      c(
        "q4",
        "Observability",
        "must",
        "missing",
        0,
        "Repository không truy cập được.",
        [],
      ),
      c("q5", "Bảo mật hạ tầng", "nice", "missing", 0, "Chưa có dữ liệu.", []),
    ],
    repo: "huyvo/infra",
    repoState: "failed",
  },
  {
    id: "linh",
    name: "Đặng Mai Linh",
    initials: "ML",
    hue: 320,
    role: "Data Engineer",
    position: "Data Engineer",
    level: "Middle",
    status: "processing",
    updated: "26/10 · 11:15",
    updatedAt: "26/10/2026 · 11:15",
    email: "linh.dang@gmail.com",
    phone: "094 510 7723",
    location: "Cầu Giấy, Hà Nội",
    years: 4,
    createdAt: "26/10/2026 · 10:40",
    source: "CV + GitHub",
    summary: "Đang sinh bộ câu hỏi từ repository và tiêu chí Data Engineer.",
    strengths: ["SQL và mô hình dữ liệu", "Python và Airflow"],
    verify: [
      "Chưa hoàn tất đối chiếu tiêu chí",
      "Repository đang được phân tích",
    ],
    criteria: [
      c(
        "l1",
        "SQL và mô hình dữ liệu",
        "must",
        "verified",
        2,
        "CV và repository.",
        ["CV", "Git · models"],
      ),
      c(
        "l2",
        "Python và orchestration",
        "must",
        "verified",
        2,
        "Airflow DAG trong repo.",
        ["Git · dags"],
      ),
      c("l3", "Chất lượng dữ liệu", "must", "inferred", 1, "Có test schema.", [
        "Git · tests",
      ]),
      c("l4", "Streaming", "nice", "missing", 0, "Chưa có dữ liệu.", []),
    ],
    repo: "linhdang/recruiting-warehouse",
    repoBranch: "develop",
    commit: "9d2e117",
    repoState: "connected",
    stageIndex: 4,
  },
  {
    id: "tung",
    name: "Bùi Thanh Tùng",
    initials: "TT",
    hue: 96,
    role: "Full-stack Developer",
    position: "Full-stack Developer",
    level: "Middle",
    status: "completed",
    updated: "25/10 · 16:30",
    updatedAt: "25/10/2026 · 16:30",
    email: "tung.bui@gmail.com",
    phone: "091 330 0956",
    location: "Thanh Xuân, Hà Nội",
    years: 4,
    createdAt: "24/10/2026 · 11:20",
    source: "CV + GitHub",
    reviewer: "Thu Trang",
    summary:
      "Full-stack developer với TypeScript, Node.js và PostgreSQL. Repository onboarding-flow cho thấy kinh nghiệm API và test, nhưng observability còn mỏng.",
    strengths: ["TypeScript và React", "API Node.js với test tích hợp"],
    verify: [
      "Observability chưa có bằng chứng",
      "Chưa thấy kinh nghiệm với queue",
    ],
    criteria: [
      c(
        "t1",
        "TypeScript và React",
        "must",
        "verified",
        2,
        "Repo onboarding-flow.",
        ["Git · web"],
      ),
      c(
        "t2",
        "Node.js hoặc .NET API",
        "must",
        "verified",
        2,
        "API Express với 8 route.",
        ["Git · api"],
      ),
      c(
        "t3",
        "PostgreSQL và ORM",
        "must",
        "verified",
        2,
        "Prisma schema và migration.",
        ["Git · prisma"],
      ),
      c("t4", "Kiểm thử tích hợp", "must", "inferred", 1, "Có 6 test API.", [
        "Git · tests",
      ]),
      c("t5", "Observability", "nice", "missing", 0, "Không đủ dữ liệu.", []),
    ],
    repo: "tungbui/onboarding-flow",
    repoBranch: "main",
    commit: "4f8c2ab",
    repoState: "connected",
  },
  {
    id: "ngoc",
    name: "Hoàng Ngọc Anh",
    initials: "NA",
    hue: 348,
    role: "Mobile Engineer",
    position: "Mobile Engineer (Flutter)",
    level: "Junior",
    status: "completed",
    updated: "25/10 · 10:05",
    updatedAt: "25/10/2026 · 10:05",
    email: "ngoc.hoang@gmail.com",
    phone: "096 118 3302",
    location: "Quận 7, TP.HCM",
    years: 2,
    createdAt: "24/10/2026 · 09:40",
    source: "CV + GitHub",
    reviewer: "Minh Anh",
    summary:
      "Mobile engineer 2 năm với Flutter. Repository ứng dụng theo dõi hồ sơ có cấu trúc tốt và test widget cơ bản; kinh nghiệm state management phức tạp còn hạn chế.",
    strengths: ["Flutter và Dart", "Test widget cho luồng đăng nhập"],
    verify: [
      "Chưa thấy state management phức tạp",
      "Chưa có kinh nghiệm phát hành app store",
    ],
    criteria: [
      c("n1", "Dart và Flutter", "must", "verified", 2, "Repo candidate-app.", [
        "Git · lib",
      ]),
      c(
        "n2",
        "State management",
        "must",
        "inferred",
        1,
        "Dùng Provider; chưa thấy scale.",
        ["Git · state"],
      ),
      c("n3", "Kiểm thử widget", "nice", "verified", 1, "6 widget test.", [
        "Git · test",
      ]),
    ],
    repo: "ngocanh/candidate-app",
    repoBranch: "main",
    commit: "77ac1f0",
    repoState: "connected",
  },
  {
    id: "quan",
    name: "Đỗ Minh Quân",
    initials: "MQ",
    hue: 140,
    role: "Solutions Architect",
    position: "Solutions Architect",
    level: "Senior",
    status: "review",
    updated: "25/10 · 16:40",
    updatedAt: "25/10/2026 · 16:40",
    email: "quan.do@gmail.com",
    phone: "098 441 2207",
    location: "Quận 2, TP.HCM",
    years: 12,
    createdAt: "24/10/2026 · 15:15",
    source: "CV + tài liệu kiến trúc",
    reviewer: "Minh Anh",
    summary:
      "Solutions architect 12 năm, có kinh nghiệm thiết kế hệ thống cho khách hàng doanh nghiệp. Hồ sơ mạnh về giao tiếp và thiết kế, cần xác minh kinh nghiệm bảo mật và tuân thủ.",
    strengths: [
      "Thiết kế hệ thống và tài liệu kiến trúc",
      "Kinh nghiệm làm việc với khách hàng doanh nghiệp",
    ],
    verify: [
      "Bảo mật và tuân thủ chưa có bằng chứng",
      "Chưa thấy kinh nghiệm trực tiếp với payment",
    ],
    criteria: [
      c(
        "qu1",
        "Thiết kế hệ thống",
        "must",
        "verified",
        3,
        "3 tài liệu kiến trúc trong hồ sơ.",
        ["CV", "Tài liệu"],
      ),
      c(
        "qu2",
        "Giao tiếp với khách hàng",
        "must",
        "verified",
        2,
        "12 năm tư vấn doanh nghiệp.",
        ["CV"],
      ),
      c(
        "qu3",
        "Bảo mật và tuân thủ",
        "must",
        "inferred",
        1,
        "Có đề cập; cần phỏng vấn.",
        ["CV"],
      ),
    ],
  },
  {
    id: "lan",
    name: "Ngô Thị Lan",
    initials: "NL",
    hue: 278,
    role: "QA Automation Engineer",
    position: "QA Automation Engineer",
    level: "Middle",
    status: "completed",
    updated: "24/10 · 15:30",
    updatedAt: "24/10/2026 · 15:30",
    email: "lan.ngo@gmail.com",
    phone: "093 220 8841",
    location: "Hải Châu, Đà Nẵng",
    years: 5,
    createdAt: "23/10/2026 · 14:05",
    source: "CV + GitHub",
    reviewer: "Thu Trang",
    summary:
      "QA automation 5 năm với Playwright và API testing. Repository e2e-suite có bộ test ổn định; cần xác minh kinh nghiệm xử lý flaky test ở CI quy mô lớn.",
    strengths: ["Playwright và API testing", "Test suite 84 case"],
    verify: ["Kinh nghiệm flaky test ở CI lớn", "Chưa thấy test hiệu năng"],
    criteria: [
      c(
        "la1",
        "Playwright / Cypress",
        "must",
        "verified",
        2,
        "Repo e2e-suite.",
        ["Git · e2e"],
      ),
      c("la2", "API testing", "must", "verified", 2, "42 API test.", [
        "Git · api-test",
      ]),
      c(
        "la3",
        "CI và flaky test",
        "nice",
        "inferred",
        1,
        "Có retry; chưa thấy báo cáo flaky.",
        ["Git · ci"],
      ),
    ],
    repo: "lanngo/e2e-suite",
    repoBranch: "main",
    commit: "2b6d880",
    repoState: "connected",
  },
  {
    id: "vy",
    name: "Trịnh Khánh Vy",
    initials: "KV",
    hue: 60,
    role: "Senior .NET Backend",
    position: "Senior .NET Backend",
    level: "Senior",
    status: "review",
    updated: "26/10 · 08:10",
    updatedAt: "26/10/2026 · 08:10",
    email: "vy.trinh@gmail.com",
    phone: "090 774 1129",
    location: "Quận 10, TP.HCM",
    years: 6,
    createdAt: "25/10/2026 · 09:30",
    source: "CV",
    reviewer: "Minh Anh",
    summary:
      "Backend engineer 6 năm với .NET, chưa kết nối repository. Hồ sơ CV mạnh về API và EF Core; các tiêu chí kiến trúc cần phỏng vấn để xác minh.",
    strengths: ["6 năm .NET và API", "Kinh nghiệm PostgreSQL"],
    verify: [
      "Chưa có repository để đối chiếu",
      "Thiết kế phân tán chưa có bằng chứng",
    ],
    criteria: [
      c(
        "v1",
        "5+ năm phát triển .NET / C#",
        "must",
        "verified",
        2,
        "6 năm trong CV.",
        ["CV"],
      ),
      c(
        "v2",
        "Thiết kế REST API và versioning",
        "must",
        "verified",
        1,
        "Mô tả dự án trong CV.",
        ["CV"],
      ),
      c("v3", "EF Core và PostgreSQL", "must", "inferred", 1, "CV đề cập.", [
        "CV",
      ]),
      c(
        "v4",
        "Message broker (RabbitMQ)",
        "must",
        "missing",
        0,
        "Chưa có dữ liệu.",
        [],
      ),
      c("v5", "Kiểm thử tự động", "must", "missing", 0, "Chưa có dữ liệu.", []),
      c(
        "v6",
        "Thiết kế hệ thống phân tán",
        "must",
        "missing",
        0,
        "Chưa có dữ liệu.",
        [],
      ),
    ],
  },
  {
    id: "kiet",
    name: "Lâm Tuấn Kiệt",
    initials: "TK",
    hue: 168,
    role: "DevOps Engineer",
    position: "DevOps Engineer",
    level: "Senior",
    status: "review",
    updated: "24/10 · 10:15",
    updatedAt: "24/10/2026 · 10:15",
    email: "kiet.lam@gmail.com",
    phone: "091 552 7730",
    location: "Thủ Đức, TP.HCM",
    years: 7,
    createdAt: "23/10/2026 · 17:25",
    source: "CV + GitLab",
    reviewer: "Quang Dũng",
    summary:
      "DevOps engineer 7 năm, kinh nghiệm Kubernetes và Terraform. Repository infra có module rõ ràng; cần kiểm tra observability và quy trình sự cố.",
    strengths: ["Kubernetes và Terraform", "CI/CD cho 30+ service"],
    verify: [
      "Observability chưa có bằng chứng",
      "Quy trình incident response cần phỏng vấn",
    ],
    criteria: [
      c(
        "k1",
        "Kubernetes và container",
        "must",
        "verified",
        2,
        "Repo infra và CV.",
        ["CV", "Git · k8s"],
      ),
      c("k2", "Terraform / IaC", "must", "verified", 2, "3 module Terraform.", [
        "Git · terraform",
      ]),
      c("k3", "CI/CD", "must", "verified", 2, "Pipeline GitLab.", ["Git · ci"]),
      c(
        "k4",
        "Observability",
        "must",
        "inferred",
        1,
        "Có Prometheus; chưa thấy alert.",
        ["Git · monitoring"],
      ),
      c("k5", "Bảo mật hạ tầng", "nice", "missing", 0, "Chưa có dữ liệu.", []),
    ],
    repo: "kietlam/infra",
    repoBranch: "main",
    commit: "e31b6c9",
    repoState: "connected",
  },
  {
    id: "phuc",
    name: "Phạm Gia Khiêm",
    initials: "GK",
    hue: 240,
    role: "Full-stack Developer",
    position: "Full-stack Developer",
    level: "Middle",
    status: "processing",
    updated: "26/10 · 13:20",
    updatedAt: "26/10/2026 · 13:20",
    email: "khiem.pham@gmail.com",
    phone: "097 881 0042",
    location: "Quận 5, TP.HCM",
    years: 3,
    createdAt: "26/10/2026 · 13:18",
    source: "CV",
    summary: "Đang đọc tệp CV.",
    strengths: ["3 năm Go và React"],
    verify: ["Chưa có dữ liệu phân tích"],
    criteria: [
      c(
        "p1",
        "TypeScript và React",
        "must",
        "inferred",
        1,
        "Đang trích xuất.",
        ["CV"],
      ),
      c(
        "p2",
        "Node.js hoặc .NET API",
        "must",
        "missing",
        0,
        "Chưa có dữ liệu.",
        [],
      ),
    ],
    stageIndex: 0,
  },
  {
    id: "chau",
    name: "Trần Bảo Châu",
    initials: "BC",
    hue: 302,
    role: "Frontend Engineer",
    position: "Frontend Engineer (React)",
    level: "Middle",
    status: "processing",
    updated: "26/10 · 12:55",
    updatedAt: "26/10/2026 · 12:55",
    email: "chau.tran@gmail.com",
    phone: "090 225 7719",
    location: "Quận Bình Thạnh, TP.HCM",
    years: 4,
    createdAt: "26/10/2026 · 12:40",
    source: "CV + GitHub",
    summary: "Đang phân tích repository và đối chiếu tiêu chí Frontend.",
    strengths: ["React và TypeScript", "Storybook"],
    verify: ["Repository đang phân tích"],
    criteria: [
      c(
        "ch1",
        "React và TypeScript",
        "must",
        "verified",
        2,
        "Component trong repo.",
        ["Git · src"],
      ),
      c(
        "ch2",
        "Design system và accessibility",
        "must",
        "inferred",
        1,
        "Storybook có; axe chưa thấy.",
        ["Git · stories"],
      ),
      c("ch3", "Kiểm thử component", "must", "missing", 0, "Chưa có test.", []),
      c("ch4", "Quản lý state", "must", "inferred", 1, "Zustand.", [
        "Git · store",
      ]),
    ],
    repo: "baochau/portal-ui",
    repoBranch: "main",
    commit: "5c1e804",
    repoState: "connected",
    stageIndex: 3,
  },
];

export const candidateById = new Map(candidates.map((item) => [item.id, item]));

export function candidateEvidence(candidate: Candidate) {
  return evidenceSummary(candidate.criteria);
}

export function getSkills(candidate: Candidate): Skill[] {
  if (candidate.skills?.length) return candidate.skills;
  return candidate.criteria.map((item) =>
    s(
      item.label,
      item.state === "verified"
        ? "Thành thạo"
        : item.state === "inferred"
          ? "Khá"
          : "Chưa rõ",
      item.state === "verified"
        ? "Cao"
        : item.state === "inferred"
          ? "Trung bình"
          : "Thấp",
      item.state,
      item.sources.join(" · ") || "Không đủ dữ liệu",
      item.evidence,
    ),
  );
}

export function buildHistory(candidate: Candidate): HistoryEvent[] {
  const events: HistoryEvent[] = [
    {
      at: candidate.createdAt,
      title: "CV được tải lên",
      detail: `${candidate.source} · ${candidate.position}`,
      actor: candidate.reviewer ?? "Minh Anh",
    },
    {
      at: candidate.createdAt,
      title: "Trích xuất CV hoàn tất",
      detail: "Thông tin liên hệ, kinh nghiệm và liên kết được trích xuất.",
      actor: "CodeCV AI",
    },
  ];
  if (candidate.repoState === "connected" && candidate.repo) {
    events.push({
      at: candidate.updatedAt,
      title: "Repository được kết nối",
      detail: `${candidate.repo} · nhánh ${candidate.repoBranch ?? "main"} · ${candidate.commit ?? "—"}`,
      actor: "CodeCV AI",
    });
  }
  if (candidate.repoState === "failed") {
    events.push({
      at: candidate.updatedAt,
      title: "Không truy cập được repository",
      detail: "Repository riêng tư hoặc token đã hết hạn. Cần cấp lại quyền.",
      actor: "CodeCV AI",
    });
  }
  if (candidate.status === "completed" || candidate.status === "review") {
    events.push({
      at: candidate.updatedAt,
      title: "Phân tích hoàn tất",
      detail: `${candidate.criteria.length} tiêu chí JD · ${candidate.repo ? "repository đã phân tích" : "chỉ phân tích CV"}`,
      actor: "CodeCV AI",
    });
    events.push({
      at: candidate.updatedAt,
      title: "Báo cáo v3 được tạo",
      detail:
        "Báo cáo tổng hợp bằng chứng, điểm cần xác minh và câu hỏi phỏng vấn.",
      actor: "Minh Anh",
    });
  }
  if (candidate.status === "review") {
    events.push({
      at: candidate.updatedAt,
      title: "Chờ review",
      detail: `Người review: ${candidate.reviewer ?? "Minh Anh"}`,
      actor: "Hệ thống",
    });
  }
  return events;
}

export function generateQuestions(candidate: Candidate): Question[] {
  const pool = candidate.criteria.slice(0, 5);
  return pool.map((item, index) => ({
    id: `${candidate.id}-gen-${index}`,
    category:
      index % 5 === 0
        ? "Architecture"
        : index % 5 === 1
          ? "Database"
          : index % 5 === 2
            ? "Messaging"
            : index % 5 === 3
              ? "Security"
              : "Testing",
    difficulty: candidate.level === "Senior" ? "Senior" : "Middle",
    text: `Bạn đã xử lý "${item.label}" trong công việc gần nhất như thế nào?`,
    answer:
      "Câu trả lời cần nêu bối cảnh, quyết định kỹ thuật, trade-off và cách kiểm chứng kết quả. Đối chiếu với bằng chứng trong hồ sơ trước khi kết luận.",
    followUps: ["Bạn sẽ làm khác đi điều gì nếu có thêm thời gian?"],
  }));
}

export const reportRows = [
  {
    id: "RPT-8F3A2C",
    candidateId: "an",
    candidate: "Nguyễn Văn An",
    position: "Senior .NET Backend",
    version: 3,
    status: "exported" as const,
    reviewer: "Minh Anh",
    created: "26/10/2026 · 14:18",
  },
  {
    id: "RPT-7D1B9E",
    candidateId: "minh",
    candidate: "Lê Hoàng Minh",
    position: "Senior .NET Backend",
    version: 2,
    status: "review" as const,
    reviewer: "Minh Anh",
    created: "26/10/2026 · 09:20",
  },
  {
    id: "RPT-6C4A1D",
    candidateId: "ha",
    candidate: "Phạm Thu Hà",
    position: "Frontend Engineer (React)",
    version: 2,
    status: "exported" as const,
    reviewer: "Thu Trang",
    created: "25/10/2026 · 17:02",
  },
  {
    id: "RPT-5B2E7F",
    candidateId: "quan",
    candidate: "Đỗ Minh Quân",
    position: "Solutions Architect",
    version: 1,
    status: "review" as const,
    reviewer: "Minh Anh",
    created: "25/10/2026 · 16:40",
  },
  {
    id: "RPT-4A9C3B",
    candidateId: "tung",
    candidate: "Bùi Thanh Tùng",
    position: "Full-stack Developer",
    version: 2,
    status: "exported" as const,
    reviewer: "Thu Trang",
    created: "24/10/2026 · 15:55",
  },
  {
    id: "RPT-3F8D6A",
    candidateId: "ngoc",
    candidate: "Hoàng Ngọc Anh",
    position: "Mobile Engineer (Flutter)",
    version: 1,
    status: "exported" as const,
    reviewer: "Minh Anh",
    created: "24/10/2026 · 11:30",
  },
  {
    id: "RPT-2E7B5C",
    candidateId: "lan",
    candidate: "Ngô Thị Lan",
    position: "QA Automation Engineer",
    version: 1,
    status: "exported" as const,
    reviewer: "Thu Trang",
    created: "23/10/2026 · 10:12",
  },
  {
    id: "RPT-1D6A4E",
    candidateId: "huy",
    candidate: "Võ Quốc Huy",
    position: "DevOps Engineer",
    version: 1,
    status: "failed" as const,
    reviewer: "Minh Anh",
    created: "23/10/2026 · 09:05",
  },
  {
    id: "RPT-0C5F3D",
    candidateId: "vy",
    candidate: "Trịnh Khánh Vy",
    position: "Senior .NET Backend",
    version: 1,
    status: "review" as const,
    reviewer: "Minh Anh",
    created: "24/10/2026 · 10:15",
  },
];

export const reportStatusMeta: Record<
  "exported" | "review" | "failed",
  { labelKey: MessageKey; className: string }
> = {
  exported: { labelKey: "reportStatus.exported", className: "pill-positive" },
  review: { labelKey: "reportStatus.review", className: "pill-warning" },
  failed: { labelKey: "reportStatus.failed", className: "pill-negative" },
};

export const teamMembers = [
  {
    name: "Minh Anh",
    initials: "MA",
    role: "Owner",
    email: "minhanh@codecv.ai",
    hue: 243,
  },
  {
    name: "Thu Trang",
    initials: "TT",
    role: "Recruiter",
    email: "thutrang@codecv.ai",
    hue: 168,
  },
  {
    name: "Quang Dũng",
    initials: "QD",
    role: "Reviewer",
    email: "quangdung@codecv.ai",
    hue: 28,
  },
  {
    name: "Hải Yến",
    initials: "HY",
    role: "Recruiter",
    email: "haiyen@codecv.ai",
    hue: 320,
  },
];

export const aiModels = [
  {
    id: "gemini",
    name: "Gemini 3.5 Flash Lite",
    provider: "Google",
    note: "Đang dùng cho phân tích CV và repository.",
    active: true,
  },
  {
    id: "gpt",
    name: "GPT-5.1",
    provider: "OpenAI",
    note: "Được bật cho interview studio.",
    active: true,
  },
  {
    id: "claude",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    note: "Được bật cho đọc tài liệu dài.",
    active: true,
  },
  {
    id: "local",
    name: "Qwen2.5 72B",
    provider: "Self-hosted",
    note: "Chỉ dùng cho dữ liệu nội bộ.",
    active: false,
  },
];

export const uploadStages = [
  { id: 1, label: "Đọc tệp", detail: "Kiểm tra định dạng và dung lượng" },
  {
    id: 2,
    label: "Trích xuất CV",
    detail: "Thông tin liên hệ, kinh nghiệm, kỹ năng",
  },
  {
    id: 3,
    label: "Đối chiếu JD",
    detail: "So khớp tiêu chí và nguồn bằng chứng",
  },
  {
    id: 4,
    label: "Đọc GitHub",
    detail: "Repo hoặc hồ sơ GitHub công khai trong CV",
  },
  { id: 5, label: "Sinh câu hỏi", detail: "Câu hỏi, đáp án và rubric" },
  { id: 6, label: "Hoàn tất", detail: "Tạo báo cáo và mở review" },
];

export const repoTree = [
  {
    name: "src",
    type: "folder" as const,
    children: [
      {
        name: "Orders.Api",
        type: "folder" as const,
        children: [
          {
            name: "Controllers",
            type: "folder" as const,
            children: [
              {
                name: "OrdersController.cs",
                type: "file" as const,
                active: false,
              },
            ],
          },
          { name: "Program.cs", type: "file" as const, active: false },
        ],
      },
      {
        name: "Orders.Application",
        type: "folder" as const,
        children: [
          {
            name: "Contracts",
            type: "folder" as const,
            children: [
              { name: "OrderCreated.cs", type: "file" as const, active: false },
            ],
          },
          {
            name: "Orders",
            type: "folder" as const,
            children: [
              {
                name: "CreateOrderHandler.cs",
                type: "file" as const,
                active: false,
              },
            ],
          },
        ],
      },
      {
        name: "Orders.Domain",
        type: "folder" as const,
        children: [{ name: "Order.cs", type: "file" as const, active: false }],
      },
      {
        name: "Orders.Infrastructure",
        type: "folder" as const,
        children: [
          {
            name: "Messaging",
            type: "folder" as const,
            children: [
              {
                name: "RabbitMqConsumer.cs",
                type: "file" as const,
                active: true,
              },
            ],
          },
          {
            name: "Persistence",
            type: "folder" as const,
            children: [
              {
                name: "OrderRepository.cs",
                type: "file" as const,
                active: false,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "tests",
    type: "folder" as const,
    children: [
      {
        name: "Orders.Tests",
        type: "folder" as const,
        children: [
          {
            name: "CreateOrderHandlerTests.cs",
            type: "file" as const,
            active: false,
          },
          {
            name: "RabbitMqConsumerTests.cs",
            type: "file" as const,
            active: false,
          },
        ],
      },
    ],
  },
];

export const architectureLayers = [
  {
    id: "api",
    label: "API",
    tech: "ASP.NET Core · 6 endpoint",
    evidence: 6,
    path: "Orders.Api",
    nodes: ["OrdersController", "Program"],
  },
  {
    id: "application",
    label: "Application",
    tech: "Use case · 9 handler",
    evidence: 9,
    path: "Orders.Application",
    nodes: ["CreateOrder", "CancelOrder", "GetOrder"],
  },
  {
    id: "domain",
    label: "Domain",
    tech: "Aggregate · 4 entity",
    evidence: 4,
    path: "Orders.Domain",
    nodes: ["Order", "OrderItem", "Money", "OrderStatus"],
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    tech: "Adapter · 7 module",
    evidence: 7,
    path: "Orders.Infrastructure",
    nodes: ["EF Core · PostgreSQL", "RabbitMQ", "Redis"],
  },
];

export const dashboardAnalysis = [
  {
    candidateId: "binh",
    name: "Trần Thị Bình",
    role: "Full-stack Developer",
    stage: "Đối chiếu JD",
    step: 3,
    detail: "Đang so khớp 5 tiêu chí",
  },
  {
    candidateId: "linh",
    name: "Đặng Mai Linh",
    role: "Data Engineer",
    stage: "Sinh câu hỏi",
    step: 5,
    detail: "Đang tạo 12 câu hỏi",
  },
  {
    candidateId: "phuc",
    name: "Phạm Gia Khiêm",
    role: "Full-stack Developer",
    stage: "Đọc tệp",
    step: 1,
    detail: "Đang đọc CV.pdf",
  },
  {
    candidateId: "chau",
    name: "Trần Bảo Châu",
    role: "Frontend Engineer",
    stage: "Phân tích repository",
    step: 4,
    detail: "portal-ui · 42 tệp",
  },
];
