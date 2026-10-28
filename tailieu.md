# UI/UX LandAI — Modern Real Estate Intelligence

Định hướng giao diện: Clean, Minimal, Map-first, AI-native — bản đồ là trung tâm, dữ liệu được trình bày gọn gàng, AI hỗ trợ phân tích ngay bên cạnh. Tránh kiểu dashboard truyền thống quá nhiều bảng, màu sắc và biểu đồ gây rối mắt.

## 1. Phong cách thiết kế tổng thể

### LandAI

Tìm kiếm bất động sản...

AI PROPERTY INSIGHTS

Phân tích vị trí

Light mode — mặc định

Nền sáng, chữ rõ, viền nhẹ, xanh navy làm màu thương hiệu.

### LandAI

&#x20;Tìm kiếm bất động sản...

AI PROPERTY INSIGHTS

Phân tích vị trí

Dark mode — tùy chọn

Phù hợp theo dõi bản đồ, phân tích dữ liệu và sử dụng vào buổi tối.

Design tokens đề xuất

- Màu thương hiệu: xanh navy `#172554`.
- Màu hành động: xanh dương `#2563EB`.
- Nền: `#F8FAFC`; bề mặt: trắng.
- Chữ chính: `#0F172A`; chữ phụ: `#64748B`.
- Font: Inter hoặc Be Vietnam Pro.
- Bo góc: 10–14 px; viền mảnh; đổ bóng rất nhẹ.
- Khoảng cách theo hệ thống 4/8 px.
- Ưu tiên icon Lucide, hạn chế emoji, gradient và hiệu ứng trang trí.

## 2. Bố cục màn hình tra cứu chính

[Prophetic - The AI-Native Land Acquisition Platform](https://images.openai.com/static-rsc-4/BAWTcl_pPb8FDP_dX3FK0j0IkG7S59O7sWKnz9dTTBOz8ZEl-RnMVFn4tTHCcuUh2x9nhdNH_ZFCk8sEwHzhkuP7_ylUdeGH_1KnyDarSKG0XTevjBHD90R0wFFVCybfHwJ0q1DLh9Hj1MdTCJ9mGas0YzydT0LrGuxhywfIxXo?purpose=inline)

[propheticsoftware.ai](https://www.propheticsoftware.ai/)

Màn hình desktop nên có ba khu vực chính:

A. Sidebar trái — 250–280 px

- Logo LandAI và nút thu gọn sidebar.
- Ô tìm kiếm địa chỉ, số thửa, khu vực.
- Bộ lọc theo loại đất, diện tích, mức giá.
- Lớp dữ liệu: thửa đất, quy hoạch, giá tham khảo.
- Lịch sử vị trí và danh sách bất động sản đã lưu.

B. Bản đồ trung tâm — chiếm 55–70% màn hình

- Bản đồ chiếm phần lớn không gian sử dụng.
- Thanh tìm kiếm nổi ở phía trên.
- Các nút định vị, phóng to/thu nhỏ và chuyển kiểu bản đồ.
- Ranh giới thửa đất nổi bật khi được chọn.
- Các điểm bất động sản có thể nhóm theo cụm khi thu nhỏ.
- Nhấn vào thửa đất để mở thông tin nhanh mà không chuyển trang.

C. Panel phải — 360–420 px

Sử dụng panel có thể chuyển tab giữa Thông tin, Quy hoạch, Giá thị trường và AI phân tích. Nội dung thay đổi theo vị trí đang chọn, tránh mở quá nhiều popup trên bản đồ.

Kích thước trên là mục tiêu thiết kế cho desktop, có thể co giãn theo màn hình. Trên laptop nhỏ, sidebar và panel phải nên thu gọn được để bản đồ không bị bó hẹp.

## 3. Thiết kế panel thông tin bất động sản

Khi người dùng click một thửa đất, panel bên phải nên hiển thị thông tin theo thứ tự quan trọng nhất.

THỬA ĐẤT ĐANG CHỌN

## Thông tin bất động sản

Địa chỉ được xác định từ dữ liệu tra cứu

Diện tích

## — m²

Giá tham khảo

## Chưa có dữ liệu

Thông tin thửa đất

Số tờ bản đồ

Chưa xác minh

Số thửa

Chưa xác minh

Loại đất

Chưa xác minh

AI phân tích vị trí

Tổng hợp dữ liệu có sẵn, chỉ ra điểm cần kiểm tra và giải thích cơ sở nhận định.

“Hãy phân tích vị trí này, so sánh giá khu vực lân cận và cho biết dữ liệu nào còn thiếu.”

Đặc tả component này

Các giá trị dấu gạch ngang trong mẫu chỉ là trạng thái minh họa khi chưa có dữ liệu, không phải thông tin bất động sản thực tế.

## 4. UX của AI — không nên giống chatbot thông thường

AI nên hiểu vị trí mà người dùng đang chọn. Người dùng không cần nhập lại địa chỉ trong mỗi câu hỏi.

LandAI Assistant

Đang sử dụng vị trí đã chọn

Bạn muốn tìm hiểu điều gì về bất động sản này?

Kiểm tra quy hoạch

So sánh giá đất

Phân tích đầu tư

Checklist pháp lý

Hỏi thêm về vị trí này...

Mỗi câu trả lời AI nên có ba lớp:

1. Kết luận ngắn: nội dung người dùng cần biết.
2. Căn cứ: số liệu, nguồn, thời điểm cập nhật và phạm vi khảo sát.
3. Việc cần xác minh: thông tin còn thiếu hoặc cần đối chiếu với cơ quan có thẩm quyền.

## 5. Các nguyên tắc UX quan trọng

- Map-first: giữ bản đồ làm trung tâm, không để dashboard lấn át.
- Progressive disclosure: chỉ hiển thị thông tin cơ bản trước; chi tiết nằm trong tab hoặc mục mở rộng.
- Không có dữ liệu cũng phải đẹp: dùng empty state rõ ràng, hướng dẫn bước tiếp theo thay vì hiển thị ô trống.
- Phản hồi tức thì: khi click bản đồ, marker xuất hiện ngay; các phần dữ liệu tải độc lập bằng skeleton.
- Đồng bộ vị trí: marker, panel, bộ lọc và câu hỏi AI luôn gắn với cùng một vị trí đang chọn.
- Responsive: desktop ưu tiên bản đồ và panel song song; mobile dùng bản đồ toàn màn hình với bottom sheet kéo lên.
- Accessible: tương phản đủ tốt, hỗ trợ bàn phím và không chỉ dùng màu sắc để phân biệt trạng thái.

## 6. Stack giao diện phù hợp

Với dự án này, mình chọn:

- Next.js + TypeScript — nền tảng giao diện.
- Ant Design — form, bảng, drawer, tabs và hệ thống quản trị.
- Tailwind CSS — bố cục và design tokens; dùng có kiểm soát để không tạo hai hệ thống style chồng chéo.
- MapLibre GL JS — bản đồ tương tác, lớp dữ liệu địa lý và polygon.
- Lucide Icons — bộ icon thống nhất.
- TanStack Query — cache, loading và đồng bộ trạng thái truy vấn API.

Nếu mục tiêu là sản phẩm thương mại lâu dài, hãy xây dựng UI theo design system ngay từ đầu, thay vì thiết kế mỗi màn hình theo một kiểu riêng.

Đề xuất cuối cùng: LandAI nên mang cảm giác của một công cụ bản đồ chuyên nghiệp kết hợp trợ lý AI, tương tự các ứng dụng SaaS dữ liệu hiện đại: giao diện sáng, ít chi tiết thừa, bản đồ rộng, panel thông tin gọn và AI luôn hiểu ngữ cảnh vị trí.