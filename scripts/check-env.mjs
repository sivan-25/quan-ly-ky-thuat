import { loadEnv } from "vite";
const env = { ...loadEnv("production", process.cwd(), ""), ...process.env };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (
  process.env.VERCEL &&
  (!url || !key || url.includes("YOUR_PROJECT") || key.includes("YOUR_"))
)
  throw new Error(
    "Thiếu cấu hình Supabase trên Vercel. Cần VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY.",
  );
if (key?.startsWith("sb_secret_"))
  throw new Error(
    "Không được đưa Supabase secret key vào frontend. Dùng publishable key.",
  );
if (key?.startsWith("eyJ")) {
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString(),
    );
    if (payload.role !== "anon")
      throw new Error("Chỉ được dùng anon key cho frontend.");
  } catch (error) {
    throw new Error("Khóa Supabase legacy không hợp lệ: " + error.message);
  }
}
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))
  throw new Error(
    "Cấu hình hiện hỗ trợ URL Supabase Cloud dạng https://PROJECT.supabase.co.",
  );
