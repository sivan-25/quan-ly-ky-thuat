import { supabase as db } from "./supabase";
import { validateTask, validateImages } from "./domain";
const bucket = () => db.storage.from("task-images");
const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};
export async function loadContext(userId) {
  const [profile, buildings, members] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).single(),
    db.from("buildings").select("*").order("id"),
    db.from("building_members").select("*").eq("user_id", userId),
  ]);
  return {
    profile: unwrap(profile),
    buildings: unwrap(buildings),
    members: unwrap(members),
  };
}
export async function loadTasks() {
  let rows = [];
  // Explicit pagination: do not silently truncate exports at Supabase's row limit.
  for (let offset = 0; ; offset += 500) {
    const page = unwrap(
      await db
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499),
    );
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows;
}
export async function saveTask(task) {
  const fields = validateTask(task);
  if (task.id) {
    const row = unwrap(
      await db
        .from("tasks")
        .update(fields)
        .eq("id", task.id)
        .eq("updated_at", task.updated_at)
        .select()
        .maybeSingle(),
    );
    if (!row)
      throw new Error(
        "Công việc đã được người khác thay đổi hoặc bạn không còn quyền sửa. Đóng cửa sổ, làm mới danh sách và mở lại.",
      );
    return row;
  }
  return unwrap(await db.from("tasks").insert(fields).select().single());
}
export async function listImages(task) {
  const prefix = `${task.building_id}/${task.id}`;
  let files = [];
  for (let offset = 0; ; offset += 100) {
    const page = unwrap(
      await bucket().list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    );
    files.push(
      ...page
        .filter((f) => f.id)
        .map((f) => ({ name: f.name, path: `${prefix}/${f.name}` })),
    );
    if (page.length < 100) break;
  }
  return files;
}
export async function signedImages(task) {
  const files = await listImages(task);
  if (!files.length) return [];
  const urls = unwrap(
    await bucket().createSignedUrls(
      files.map((f) => f.path),
      3600,
    ),
  );
  return files.map((f, i) => ({ ...f, url: urls[i].signedUrl }));
}
export async function uploadImages(task, files) {
  validateImages(files);
  const done = [];
  try {
    for (const f of files) {
      const ext = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      }[f.type];
      const path = `${task.building_id}/${task.id}/${crypto.randomUUID()}.${ext}`;
      unwrap(
        await bucket().upload(path, f, { contentType: f.type, upsert: false }),
      );
      done.push(path);
    }
  } catch (error) {
    if (done.length) {
      const { error: rollbackError } = await bucket().remove(done);
      if (rollbackError)
        throw new Error(
          "Tải ảnh chưa hoàn tất. Một số ảnh đã lưu; mở Hình ảnh để kiểm tra trước khi tải lại.",
        );
    }
    throw error;
  }
}
export async function removeImage(path) {
  unwrap(await bucket().remove([path]));
}
export async function deleteTask(task) {
  let locked;
  if (task.deleting_at) {
    locked = unwrap(
      await db
        .from("tasks")
        .select("*")
        .eq("id", task.id)
        .eq("updated_at", task.updated_at)
        .maybeSingle(),
    );
  } else {
    locked = unwrap(
      await db
        .from("tasks")
        .update({ deleting_at: new Date().toISOString() })
        .eq("id", task.id)
        .eq("updated_at", task.updated_at)
        .select()
        .maybeSingle(),
    );
  }
  if (!locked)
    throw new Error(
      "Công việc đã thay đổi hoặc bạn không còn quyền xóa. Hãy làm mới danh sách.",
    );
  const files = await listImages(locked);
  if (files.length) unwrap(await bucket().remove(files.map((f) => f.path)));
  const deleted = unwrap(
    await db
      .from("tasks")
      .delete()
      .eq("id", locked.id)
      .eq("updated_at", locked.updated_at)
      .select("id"),
  );
  if (!deleted.length)
    throw new Error("Chưa xóa công việc. Hãy làm mới danh sách và thử lại.");
}
export async function loadAdmin() {
  const [p, m] = await Promise.all([
    db.from("profiles").select("*").order("email"),
    db.from("building_members").select("*"),
  ]);
  return { profiles: unwrap(p), members: unwrap(m) };
}
export async function setMember(user, building, role) {
  unwrap(
    await db.rpc("set_building_member", {
      target_user: user,
      target_building: building,
      target_role: role || null,
    }),
  );
}
export function readableError(e) {
  if (e?.message?.includes("Invalid login credentials"))
    return "Email hoặc mật khẩu chưa đúng.";
  if (e?.message?.includes("Email not confirmed"))
    return "Vui lòng xác nhận email trước khi đăng nhập.";
  if (e?.message?.includes("Failed to fetch"))
    return "Không kết nối được máy chủ. Kiểm tra mạng và thử lại; dữ liệu nhập vẫn được giữ.";
  return e?.message || "Thao tác chưa thành công. Vui lòng thử lại.";
}
