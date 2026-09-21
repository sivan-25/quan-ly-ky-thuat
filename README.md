# QLKT5 — Quản lý kỹ thuật tòa nhà

Nâng cấp từ giao diện gốc của `sivan-25/quan-ly-ky-thuat`: giữ màu navy / nền kem / vàng, chuyển từ GitHub Token + JSON sang **Supabase Auth, PostgreSQL và Storage riêng tư**, triển khai **Vercel**.

## Chức năng

- Đăng nhập email/mật khẩu, đăng xuất, đặt lại mật khẩu.
- Sidebar Công việc / Hệ thống, giao diện desktop và thẻ công việc trên mobile.
- Nhập công việc ở biểu mẫu đầu trang. “Thêm công việc” lưu lên server rồi xóa nội dung đã nhập; khi lỗi dữ liệu nhập được giữ.
- Dự án: 68PĐL, 62THL, 127HH, 130HH, 399CH. Tên việc, cấp độ, ngày bắt đầu/kết thúc, người thực hiện, tiến độ, ghi chú, ảnh.
- Thêm/sửa/xóa; khóa phiên bản để không ghi đè thay đổi của người khác.
- Tìm kiếm không phân biệt dấu tiếng Việt; lọc tòa nhà, tiến độ, quá hạn, ngày/tuần/tháng/khoảng ngày. Tuần bắt đầu thứ Hai. Lọc theo **giao nhau giữa khoảng công việc và kỳ chọn**. Ngày hiện tại theo múi giờ Việt Nam.
- Phân trang hiển thị 25 việc; tải dữ liệu có phân trang từ Supabase để không cắt báo cáo ở giới hạn 1.000 dòng mặc định.
- PDF: bản báo cáo tiếng Việt A4 ngang, giữ bộ lọc, lặp tiêu đề bảng khi in, xuất tất cả công việc phù hợp; nút **In / Lưu PDF** dùng hộp thoại in trình duyệt. Báo cáo hiện gồm nội dung và ghi chú; ảnh xem trong chi tiết công việc, chưa đưa vào PDF.
- Ảnh JPG/PNG/WebP, tối đa 10 MB/ảnh, 8 ảnh/lần. Bucket riêng tư, URL xem có thời hạn 1 giờ. Mở lại chi tiết để tạo URL mới.
- Quản trị phân quyền từng tòa nhà: chỉ xem / chỉnh sửa. Tài khoản mới mặc định không có quyền xem dữ liệu.

## Chạy tại máy

Node.js >= 22.

```sh
npm ci
cp .env.example .env.local
# Điền Supabase URL và publishable key trong .env.local
npm run dev
npm run check
```

Nếu môi trường không cho đọc network interfaces, dùng `npm run dev -- --host 127.0.0.1`.

Không cần GitHub Token trong website. Phiên bản mới xóa khóa `qlkt5_config` cũ khỏi localStorage mà không đọc token. Các phiên Supabase do thư viện Auth quản lý. Không lưu bản sao công việc trong localStorage.

## Thiết lập Supabase

1. Tạo/chọn đúng Supabase project của chủ dự án. Chạy các file SQL trong `supabase/migrations/` theo thứ tự tên file qua SQL Editor hoặc áp dụng bằng CLI/migration pipeline. Migration này dành cho lần khởi tạo, chạy một lần, có transaction.
2. Trong Authentication, tắt đăng ký công khai nếu chỉ dùng nội bộ. Dùng email/password; không bật anonymous sign-in. Cấu hình Site URL và redirect URL chính xác theo domain Vercel đã triển khai. Cho phép URL `https://TEN-MIEN/?recovery=1` và URL gốc tương ứng. Cấu hình SMTP để gửi thư mời/đặt lại mật khẩu tới nhân sự thực tế.
3. Tạo tài khoản quản trị đầu tiên trong Supabase Auth (hoặc mời người dùng). Trigger tạo profile tự động. Nâng quyền đúng tài khoản bằng SQL quản trị, thay email thật trước khi chạy:

```sql
update public.profiles
set is_admin = true, display_name = 'Quản trị kỹ thuật'
where email = 'EMAIL_QUAN_TRI_THAT';
```

4. Mời/tạo thêm tài khoản qua Supabase Auth. Nếu dùng thư mời, cấu hình redirect tới `/?recovery=1` để nhân sự đặt mật khẩu. Trong trang Hệ thống, quản trị viên cấp quyền tòa nhà cho từng tài khoản. Không có chức năng tự cấp quản trị trên frontend.
5. Lấy Project URL và **publishable key**; không dùng secret/service_role key trên frontend. Legacy anon key được hỗ trợ để tương thích.
6. Áp dụng migration trên dự án thử trước; kiểm tra RLS/Storage Advisors trong Supabase rồi chạy nghiệm thu dưới đây. Bộ test PostgreSQL cục bộ không thay thế việc nghiệm thu Supabase Cloud thật.

### Mô hình bảo mật

Mọi bảng public đều bật RLS và thu hồi quyền anonymous. Hàm nội bộ nằm trong schema `private` (không đưa schema này vào Data API exposed schemas), dùng `search_path=''`. Hàm quản trị công khai kiểm tra `auth.uid()` thông qua bảng profile. `user_metadata` chỉ dùng cho tên hiển thị, không cấp quyền.

`profiles` không cho client cập nhật trực tiếp quyền quản trị. Membership được bảo vệ bằng RLS dành cho quản trị viên; RPC kiểm tra quản trị và chạy SECURITY INVOKER. Ảnh yêu cầu quyền tương ứng với tòa nhà **và** công việc tồn tại. Storage không cho ghi đè file; mỗi ảnh dùng UUID mới.

Xóa công việc đánh dấu `deleting_at` với phiên bản hiện tại trước, khóa chỉnh sửa và tải ảnh mới, xóa ảnh bằng Storage API, sau đó xóa hàng công việc. Trigger chặn xóa hàng còn ảnh. Khi mạng/người dùng mất quyền giữa chừng, công việc vẫn hiển thị “Đang xóa · thử lại”; quản trị viên/người có quyền bấm Xóa lại để hoàn tất. Không xóa trực tiếp hàng `storage.objects` bằng SQL.

Tên tòa nhà của việc đã lưu là bất biến để giữ đường dẫn Storage và quyền truy cập nhất quán. Muốn chuyển tòa nhà, tạo công việc ở tòa nhà mới rồi xử lý việc cũ sau khi kiểm tra dữ liệu.

## Triển khai Vercel

Cấu hình `vercel.json` sẵn cho Vite, SPA rewrites và security headers. Repository chưa cần backend Node riêng: dữ liệu truy cập Supabase bằng phiên Auth và RLS.

1. Đưa nhánh `feat/supabase-technical-management` lên GitHub, mở PR, kiểm tra CI.
2. Import repo `sivan-25/quan-ly-ky-thuat` trong Vercel. Framework **Vite**, Root Directory gốc repository, Build `npm run build`, Output `dist`.
3. Thêm hai biến sau vào Preview và Production (giá trị lấy từ đúng Supabase project):

| Biến | Giá trị |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://PROJECT.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key của project |

4. Deploy Preview từ nhánh tính năng; cập nhật Auth redirect URL cho domain preview được chọn. Kiểm tra tất cả luồng dưới đây bằng tài khoản thử.
5. Merge về main và triển khai Production. Cập nhật Site URL, redirect URL và kiểm tra lại đăng nhập/đặt lại mật khẩu trên domain chính thức.

Có thể triển khai từ CLI đã đăng nhập: `vercel link`, `vercel pull --environment=preview`, `vercel deploy`. Chỉ dùng `vercel --prod` sau khi cấu hình dữ liệu và nghiệm thu xong. Bản dựng trên Vercel sẽ từ chối khi thiếu biến Supabase hoặc dùng secret/service_role key.

Nếu cần rollback giao diện, chọn deployment trước trên Vercel. Không rollback bằng cách xóa bảng dữ liệu. Không phục hồi cơ chế GitHub Token để dùng dữ liệu thật.

## Kiểm thử

- `npm test`: thời gian Việt Nam, tuần qua năm, năm nhuận, tìm không dấu, giao khoảng ngày, validation; chạy migration trên PostgreSQL WASM (PGlite) với các schema Auth/Storage tối thiểu, kiểm tra RLS bằng SET ROLE và JWT subject giả.
- `npm run test:ui`: React + DOM mô phỏng API; thêm/xóa/sửa, lỗi mạng giữ dữ liệu nhập, tìm/lọc, quyền chỉ xem, xuất mọi dòng vượt trang hiện tại.
- `npm run build`: bundle production và kiểm tra biến môi trường.
- `npm run check`: toàn bộ ba bước trên.
- CI tự chạy test và build, không có khóa Supabase thật và không tự áp migration lên production.

### Nghiệm thu trên môi trường thật

- Admin: đăng nhập, tạo việc ở cả 5 tòa nhà, sửa và tải 2 ảnh, xem lại trên thiết bị khác.
- Viewer: xem/đọc ảnh/xuất PDF, không sửa/xóa/upload được kể cả gọi API trực tiếp.
- Editor của 68PĐL: không xem/sửa dữ liệu 62THL; URL ký của ảnh chỉ được tạo nếu có quyền.
- Tài khoản chưa cấp quyền và khách chưa đăng nhập không lấy được dữ liệu.
- Hai phiên sửa cùng việc: phiên cũ nhận lỗi và không ghi đè.
- Thử mất mạng khi lưu/tải ảnh; không báo thành công sai, không nhân đôi công việc.
- Xóa có xác nhận; nếu đang xóa bị gián đoạn, thử lại hoàn tất.
- Đặt lại mật khẩu qua email thật; đăng xuất; đăng nhập lại.
- Điện thoại 390px, máy tính 1440px; tìm kiếm, sửa, ảnh; PDF nhiều trang không cắt chữ tiếng Việt.

## Dữ liệu cũ

Tại commit gốc `63d6534`, repository chỉ có README và index.html; chưa thấy thư mục JSON `data/`. Không có dữ liệu cũ nào được tự tạo hoặc nhập giả. Nếu báo cáo được ghi vào repo khác, cần xác định nguồn và ánh xạ toà nhà/người thực hiện trước khi nhập một lần vào Supabase.
