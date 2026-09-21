export const BUILDINGS = ["68PĐL", "62THL", "127HH", "130HH", "399CH"];
export const STATUSES = ["Bắt đầu", "Đang thực hiện", "Hoàn thành"];
export const PRIORITIES = ["Bình thường", "Quan trọng", "Khẩn cấp"];
export function today(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export const blankTask = () => ({
  building_id: "68PĐL",
  title: "",
  priority: "Bình thường",
  start_date: today(),
  end_date: today(),
  assignee: "",
  status: "Đang thực hiện",
  notes: "",
});
export function dateRange(period, anchor) {
  if (period === "all") return ["", ""];
  const d = new Date(anchor + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return ["", ""];
  const iso = (x) => x.toISOString().slice(0, 10);
  if (period === "day") return [anchor, anchor];
  if (period === "week") {
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const start = iso(d);
    d.setUTCDate(d.getUTCDate() + 6);
    return [start, iso(d)];
  }
  if (period === "month")
    return [
      iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))),
      iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))),
    ];
  return ["", ""];
}
export const normalize = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
export function filterTasks(tasks, f) {
  if (["day", "week", "month"].includes(f.period) && !f.anchor) return [];
  if (f.period === "custom" && f.from && f.to && f.to < f.from) return [];
  const [from, to] =
    f.period === "custom" ? [f.from, f.to] : dateRange(f.period, f.anchor);
  return tasks.filter(
    (t) =>
      (!f.building || t.building_id === f.building) &&
      (!f.status ||
        (f.status === "overdue"
          ? t.status !== "Hoàn thành" && t.end_date < today()
          : t.status === f.status)) &&
      (!from || t.end_date >= from) &&
      (!to || t.start_date <= to) &&
      (!f.search ||
        normalize(
          [t.title, t.notes, t.assignee, t.building_id].join(" "),
        ).includes(normalize(f.search.trim()))),
  );
}
export function validateTask(t) {
  if (!BUILDINGS.includes(t.building_id))
    throw new Error("Vui lòng chọn tòa nhà.");
  if (!t.title.trim() || t.title.length > 500)
    throw new Error("Tên công việc cần từ 1 đến 500 ký tự.");
  if (!t.start_date || !t.end_date || t.end_date < t.start_date)
    throw new Error("Ngày kết thúc phải từ ngày bắt đầu trở đi.");
  if (!STATUSES.includes(t.status) || !PRIORITIES.includes(t.priority))
    throw new Error("Trạng thái hoặc cấp độ không hợp lệ.");
  if (t.notes.length > 20000 || t.assignee.length > 200)
    throw new Error("Ghi chú hoặc tên người thực hiện quá dài.");
  return Object.fromEntries(
    Object.keys(blankTask()).map((k) => [
      k,
      typeof t[k] === "string" ? t[k].trim() : t[k],
    ]),
  );
}
export function validateImages(files) {
  if (files.length > 8) throw new Error("Mỗi lần tải tối đa 8 ảnh.");
  for (const f of files)
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
      f.size > 10 * 1024 * 1024
    )
      throw new Error("Chọn ảnh JPG, PNG hoặc WebP, tối đa 10 MB/ảnh.");
}
export const formatDate = (d) => (d ? d.split("-").reverse().join("/") : "—");
