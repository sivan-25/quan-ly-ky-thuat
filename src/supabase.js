import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(
  url && /^https:\/\//.test(url) && key && !url.includes("YOUR_PROJECT"),
);
export const supabase = configured ? createClient(url, key) : null;
try {
  localStorage.removeItem("qlkt5_config");
} catch {
  /* Storage may be disabled. */
}
