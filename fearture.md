# UI/UX Design — CodeCV AI

Tôi đề xuất thiết kế CodeCV AI theo phong cách SaaS tuyển dụng hiện đại kết hợp AI Developer Tools: giao diện sáng, tối giản, chuyên nghiệp, ưu tiên dữ liệu và bằng chứng kỹ thuật thay vì những biểu đồ trang trí.

Trải nghiệm chính là: Upload CV → AI phân tích CV và Git → Xem báo cáo → Tạo bộ câu hỏi phỏng vấn.

## 1. Design system

[Table UI designs, themes, templates and downloadable graphic elements on Dribbble](https://images.openai.com/static-rsc-4/vMnHOCJKQxa_q--CsUqpDh14Bl40bm1DKxZU3BNHA3Os9j5NjPHswg_YrVYdNKe_hZ_CcxAwHase7r50EOFA5dy97rjI1wKjK3FELuCX5xaR0u6ZaSfV4zYDdXy1-rfhQplEgyE9OngZLF_gmc0bSQoV98rX18DalpsYQseCktE?purpose=inline)

[dribbble.com](https://dribbble.com/tags/table-ui?utm_source=chatgpt.com)

PRIMARY

Indigo · #4F46E5

Nút chính, liên kết, trạng thái đang chọn

BACKGROUND

Slate · #F8FAFC

Nền trang, vùng nội dung

TEXT

Navy · #0F172A

Tiêu đề và nội dung chính

BORDER

Slate · #E2E8F0

Viền card, phân cách nội dung

- Font: Inter hoặc Geist.
- Layout: sidebar cố định bên trái, topbar gọn, vùng nội dung co giãn.
- Card: nền trắng, viền mảnh, bo góc 10–14px, hạn chế đổ bóng.
- Icon: Lucide, nhất quán toàn ứng dụng.
- Biểu đồ: chỉ sử dụng khi có ý nghĩa phân tích; không biến điểm AI thành chỉ số chính xác tuyệt đối.
- Responsive: desktop là trải nghiệm chính; tablet hỗ trợ review, mobile tập trung xem báo cáo và câu hỏi.

## 2. Cấu trúc toàn bộ ứng dụng

### CodeCV AI

Recruitment Intelligence

WORKSPACE

Dashboard

Candidates

CV Analysis

Repository Analysis

Interview Studio

Job Descriptions

Reports

Settings

Đây là mô phỏng cấu trúc điều hướng, không phải sidebar tương tác.

Các màn hình chính:

1. Dashboard tổng quan.
2. Upload CV và tạo lượt phân tích.
3. Danh sách ứng viên.
4. Chi tiết ứng viên và báo cáo AI.
5. Phân tích repository, kiến trúc và code.
6. Interview Studio — sinh câu hỏi, đáp án và rubric.
7. Job Description và bộ tiêu chí đánh giá.
8. Báo cáo, lịch sử phân tích và cấu hình.

## 3. Màn hình Dashboard

[HireIQ – AI-Powered Hiring Platform | Smarter Recruitment](https://images.openai.com/static-rsc-4/NDPz2LApgWRtMdfvU_YdGGaGSSNY4NPCBxIkZye2M-BoPSfB1-AkdYGFS_e4MTY8FH4DPJgbcT3NuNpORm1rzLNvpNuRIPO3EwQpn0Unc7jS9VqwSJIG9IpqTSOnMeRZ7XyMOB3Bu8VJ2nn9rGeVd67NFZvpcEIRNzK0F0e1ujg?purpose=inline)

[hireiq.ai](https://hireiq.ai/?utm_source=chatgpt.com)

Đây là màn hình đầu tiên khi người dùng đăng nhập. Mục tiêu là bắt đầu đánh giá CV nhanh và theo dõi các lượt phân tích.

# Good afternoon 👋

Tổng quan hoạt động đánh giá ứng viên

&#x20;Phân tích CV mới

Tổng ứng viên

# 128

Ví dụ dữ liệu demo

Đang phân tích

# 4

Ví dụ dữ liệu demo

Báo cáo hoàn tất

# 96

Ví dụ dữ liệu demo

Chờ review

# 12

Ví dụ dữ liệu demo

### Recent candidates

Nguyen Van A

Senior .NET Backend · GitHub connected

Completed

Tran Thi B

Full-stack Developer · Parsing CV

Processing

Số liệu và ứng viên ở đây chỉ minh họa giao diện, không phải dữ liệu thực tế.

Dashboard nên có thêm thanh tìm kiếm, bộ lọc theo vị trí, trạng thái xử lý, ngày tạo và nút tiếp tục các lượt phân tích còn dang dở.

## 4. Màn hình Upload CV — điểm bắt đầu quan trọng nhất

[Talverge](https://images.openai.com/static-rsc-4/biIDHVAZOgEdp3JxCMBEh1jn01eqYMPt6Bwy78XsAAoBMqa4U3O-ZG9dulL-AtK3GvYdsCmQJb7DJToFm1liBZCWnP0Xk9fHqcEmxeHJBa9moS6PXzNeaxGBthKvKSnEwZjQbA54e8cEuy3j9ZsrEt_IORWEDa-402ckBNU5Ofs?purpose=inline)

[talverge.net](https://talverge.net/?utm_source=chatgpt.com)

Bố cục gồm hai cột:

- Bên trái — Candidate input: vùng kéo thả PDF/DOCX, xem trước tên file, chọn Job Description, cấp bậc Junior/Middle/Senior.
- Bên phải — Analysis options: phân tích CV, phân tích repository, tạo câu hỏi phỏng vấn, lựa chọn ngôn ngữ đánh giá và model AI được phép sử dụng.

Các trạng thái giao diện cần có:

1. Chưa chọn file.
2. Đang tải file lên.
3. Đã nhận diện CV và các link Git.
4. Link Git không hợp lệ hoặc repository không truy cập được.
5. Đang phân tích với tiến độ theo từng công đoạn.
6. Phân tích hoàn tất hoặc có lỗi cần xử lý.

Không nên hiển thị phần trăm tiến độ giả. Nếu hệ thống chỉ biết trạng thái của từng bước, hãy hiển thị tiến độ theo công đoạn thay vì khẳng định chính xác còn bao nhiêu giây.

## 5. Màn hình Candidate Detail — trung tâm của sản phẩm

[HyreSure | AI Recruitment Automation – Screening, Interviews & Assessments](https://images.openai.com/static-rsc-4/mjVw6P9gl0XhBmY1PKm6Du6iqVFwnVD51OXwVsc-fsyRlTomGS3Zk4mZ2dyiM1jpTbf5xC0MsyCfm0hMH7x2dchW-jjrJFtiSB9fIl5yg2X_qCpXbg9KioCxFGk1aO1bnrJMymNoElrzRLk6Nb8urwvpfFq7Y9WHnCECZAbAqPc?purpose=inline)

[hyresure.ai](https://www.hyresure.ai/?utm_source=chatgpt.com)

Đây là màn hình quan trọng nhất. Header hiển thị tên ứng viên, vị trí đang đánh giá, thời gian phân tích, phiên bản báo cáo và nút xuất báo cáo.

Các tab nên gồm:

Overview

Resume

Skills

Code Analysis

Interview Questions

History

Overview

Tóm tắt hồ sơ, kỹ năng chính, mức độ đáp ứng tiêu chí JD, điểm mạnh, điểm cần xác minh và trạng thái review.

Resume

Hiển thị thông tin trích xuất song song với trang PDF gốc để người tuyển dụng đối chiếu.

Skills

Ma trận kỹ năng, bằng chứng, độ tin cậy của nhận định và trạng thái đã xác minh/chưa xác minh.

Code Analysis

Repository, sơ đồ kiến trúc, phân tích từng module, test và phát hiện kỹ thuật.

Interview Questions

Câu hỏi, đáp án tham khảo, tiêu chí chấm điểm và ghi chú của người phỏng vấn.

Điểm cần chú ý: không nên đặt một con số như “AI đánh giá ứng viên 92/100” làm nội dung nổi bật duy nhất. Người tuyển dụng cần biết điểm đó dựa trên tiêu chí nào, có bao nhiêu bằng chứng và phần nào chưa thể đánh giá.

## 6. Màn hình Repository Analysis

[Gemini Became My Entire Hackathon Team — How a Solo Dev in Kenya Won His First MLH Prize Building RepoX - DEV Community](https://images.openai.com/static-rsc-4/0qqDAXTlIIuAcNlcLRPE6hkMmXGvScFWZWacVi_lYAQFTvRntM21epRx08DOq7tcPmRqZ87nJaJY0gOlvAQakkks_B4fjjTybOy2IpgNdjkV1UkBYa-GiH85WX4Rw5l7c-F9np2BVK7VCV8CU4SLJnrC-H_x39nlEKk3rqa43NM?purpose=inline)

[dev.to](https://dev.to/mutaician/gemini-became-my-entire-hackathon-team-how-a-solo-dev-in-kenya-won-his-first-mlh-prize-building-2k27?utm_source=chatgpt.com)

Thiết kế thành ba vùng:

Vùng trái — Repository Explorer

Danh sách repository, branch, commit SHA, cây thư mục và các file được AI phân tích.

Vùng giữa — Architecture Map

Sơ đồ API → Application → Domain → Infrastructure, database, message broker và các module. Chỉ thể hiện các thành phần có bằng chứng trong code.

Vùng phải — Findings

Nhận xét kỹ thuật, mức độ nghiêm trọng, lý do, đường dẫn file, dòng code và cách kiểm chứng.

Ví dụ khi bấm vào nhận xét “Chưa tìm thấy cơ chế idempotency”, ứng dụng mở đúng file consumer liên quan, hiển thị đoạn code và giải thích vì sao AI đưa ra nhận định đó. Người dùng có thể đánh dấu nhận xét là đúng, sai hoặc cần kiểm tra thêm.

## 7. Màn hình Interview Studio

[AI Screenr — AI Candidate Screening Software | Automate First-Round Interviews](https://images.openai.com/static-rsc-4/ZmxNqW1WyiUf_K4sW5-crZxmuxd3Ok_a70b0MeCif5K9_loC1V4LvNVIirFDHVQ3pAhguE3hpUeOFayvNb6-_b-IHIzNJHFOeReFaafNsEQl164FdzIhM1r_I206sdSeaxM3MEWhhJ8K5-DibHaReoSLbfCK8G4tWKtWNAw9O9s?purpose=inline)

[aiscreenr.com](https://www.aiscreenr.com/en?utm_source=chatgpt.com)

Màn hình này cần phục vụ trực tiếp buổi phỏng vấn, không chỉ tạo một danh sách câu hỏi để tải xuống.

## Interview Studio

15 questions

Architecture · 4

Database · 3

Messaging · 3

Security · 2

Testing · 3

QUESTION 01 · DISTRIBUTED SYSTEMS · SENIOR

## How would you make this RabbitMQ consumer idempotent?

Generated from the candidate's repository analysis. The question is intended to verify understanding, not to assume that the candidate authored every file.

View expected answer&#x20;

Interviewer notes

Ghi lại câu trả lời thực tế của ứng viên, dẫn chứng và những điểm cần hỏi sâu hơn.

Đánh giá câu trả lời

0 — Không trả lời được

1 — Hiểu khái niệm cơ bản

2 — Đề xuất được giải pháp

3 — Hiểu trade-off và xử lý lỗi

4 — Phân tích sâu, giải thích giới hạn

Điểm đang chọn: 0/4 · Minh họa tương tác, chưa lưu vào hệ thống.

Các tính năng bổ sung nên có: tạo câu hỏi theo thời lượng phỏng vấn 30/45/60 phút, đổi độ khó, tạo câu hỏi follow-up, đánh dấu câu hỏi đã hỏi và xuất bộ câu hỏi sang PDF.

## 8. Những trang nên làm trước và sau

| Mức ưu tiên | Trang               | Mục tiêu                            |
| ----------- | ------------------- | ----------------------------------- |
| P0          | Upload CV           | Khởi tạo lượt phân tích             |
| P0          | Analysis Progress   | Theo dõi các công đoạn              |
| P0          | Candidate Detail    | Đọc kết quả và bằng chứng           |
| P0          | Repository Analysis | Kiểm tra kiến trúc và code          |
| P0          | Interview Studio    | Tạo và sử dụng câu hỏi              |
| P1          | Dashboard           | Theo dõi nhiều ứng viên             |
| P1          | Candidate List      | Tìm kiếm, lọc, quản lý hồ sơ        |
| P1          | JD & Rubrics        | Tùy chỉnh tiêu chí đánh giá         |
| P2          | Team & Permissions  | Phân quyền nhóm tuyển dụng          |
| P2          | Analytics           | Đo chất lượng và hiệu quả quy trình |

Khuyến nghị cuối cùng: nếu triển khai bằng Next.js + Ant Design + ASP.NET Core, hãy xây trước ba màn hình cốt lõi: Upload CV, Candidate Detail và Repository Analysis. Chúng tạo thành một luồng hoàn chỉnh từ đầu vào đến giá trị khác biệt của sản phẩm. Sau đó mới mở rộng Dashboard và quản lý tuyển dụng nhiều ứng viên.