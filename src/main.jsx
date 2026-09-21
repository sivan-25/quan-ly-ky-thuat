import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Wrench,
  ClipboardList,
  Settings,
  LogOut,
  Search,
  Plus,
  Download,
  RefreshCw,
  Pencil,
  Trash2,
  Image as ImageIcon,
  X,
  Building2,
  ArrowRight,
  ShieldCheck,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase, configured } from "./supabase";
import * as api from "./api";
import {
  BUILDINGS,
  STATUSES,
  PRIORITIES,
  blankTask,
  today,
  filterTasks,
  formatDate,
  dateRange,
  validateImages,
} from "./domain";
import "./styles.css";

function Button({ children, icon: Icon, className = "", ...props }) {
  return (
    <button className={`button ${className}`} {...props}>
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  );
}
function Select({ options, ...props }) {
  return (
    <select {...props}>
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o}>{o}</option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ),
      )}
    </select>
  );
}
function Badge({ status }) {
  return (
    <span className={`badge status-${STATUSES.indexOf(status)}`}>
      <span />
      {status}
    </span>
  );
}
function Modal({ title, children, onClose, wide = false, busy = false }) {
  const ref = useRef();
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide" : ""}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          aria-label="Đóng"
          className="icon-button"
          disabled={busy}
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Auth({ recovery, onRecovered }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(null),
    [reset, setReset] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      let result;
      if (recovery) result = await supabase.auth.updateUser({ password });
      else if (reset)
        result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/?recovery=1",
        });
      else result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (recovery) {
        onRecovered();
        setMessage({ ok: true, text: "Đã cập nhật mật khẩu." });
      }
      if (reset)
        setMessage({
          ok: true,
          text: "Nếu email có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu.",
        });
    } catch (e) {
      setMessage({ ok: false, text: api.readableError(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-icon">
            <Wrench />
          </span>
          QLKT<span className="brand-five">5</span>
        </div>
        <div>
          <span className="eyebrow">VẬN HÀNH TÒA NHÀ</span>
          <h1>
            Mỗi công việc.
            <br />
            Một bước tiến.
          </h1>
          <p>
            Quản lý kỹ thuật tập trung.
            <br />
            Theo sát công việc, lưu giữ từng kết quả.
          </p>
          <div className="building-lines" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <small>QUẢN LÝ KỸ THUẬT · QLKT5</small>
      </section>
      <section className="auth-form">
        <div className="auth-box">
          <span className="eyebrow">CHÀO MỪNG BẠN</span>
          <h2>
            {recovery
              ? "Đặt mật khẩu mới"
              : reset
                ? "Lấy lại mật khẩu"
                : "Đăng nhập hệ thống"}
          </h2>
          <p className="muted">Sử dụng tài khoản được cấp bởi quản trị viên.</p>
          {!configured ? (
            <div className="notice">
              Website chưa được kết nối dữ liệu. Quản trị viên cần hoàn tất cấu
              hình Supabase trước khi đăng nhập.
            </div>
          ) : (
            <form onSubmit={submit}>
              {!recovery && (
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@congty.vn"
                    required
                  />
                </label>
              )}
              {(!reset || recovery) && (
                <label>
                  Mật khẩu
                  <input
                    type="password"
                    autoComplete={
                      recovery ? "new-password" : "current-password"
                    }
                    minLength={recovery ? 12 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
              )}
              {message && (
                <div
                  role="status"
                  className={`notice ${message.ok ? "success" : "error"}`}
                >
                  {message.text}
                </div>
              )}
              <Button
                className="primary full"
                icon={ArrowRight}
                disabled={busy}
              >
                {busy
                  ? "Đang xử lý…"
                  : recovery
                    ? "Lưu mật khẩu"
                    : reset
                      ? "Gửi liên kết"
                      : "Đăng nhập"}
              </Button>
              {!recovery && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setReset(!reset);
                    setMessage(null);
                  }}
                >
                  {reset ? "Quay lại đăng nhập" : "Quên mật khẩu?"}
                </button>
              )}
            </form>
          )}
          <p className="secure">
            <ShieldCheck size={16} /> Tài khoản riêng · Dữ liệu tập trung
          </p>
        </div>
      </section>
    </main>
  );
}
function TaskFields({ draft, setDraft, buildings, disabled, editing = false }) {
  const field = (key) => ({
    value: draft[key],
    onChange: (e) => setDraft({ ...draft, [key]: e.target.value }),
    disabled,
  });
  return (
    <div className="task-fields">
      <label>
        Dự án
        <Select
          {...field("building_id")}
          disabled={disabled || editing}
          options={buildings.map((b) => b.id)}
        />
      </label>
      <label className="title-field">
        Tên công việc <b>*</b>
        <input
          {...field("title")}
          maxLength={500}
          required
          placeholder="Nhập nội dung công việc…"
        />
      </label>
      <label>
        Cấp độ
        <Select {...field("priority")} options={PRIORITIES} />
      </label>
      <label>
        Ngày bắt đầu <b>*</b>
        <input type="date" {...field("start_date")} required />
      </label>
      <label>
        Ngày kết thúc <b>*</b>
        <input
          type="date"
          {...field("end_date")}
          min={draft.start_date}
          required
        />
      </label>
      <label>
        Người thực hiện
        <input
          {...field("assignee")}
          maxLength={200}
          placeholder="Tên nhân sự"
        />
      </label>
      <label>
        Tiến độ
        <Select {...field("status")} options={STATUSES} />
      </label>
      <label className="notes-field">
        Ghi chú
        <textarea
          {...field("notes")}
          maxLength={20000}
          placeholder="Chi tiết, kết quả hoặc đề xuất…"
          rows={2}
        />
      </label>
    </div>
  );
}
function Images({ task, editable, notify }) {
  const [images, setImages] = useState([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const input = useRef();
  async function load() {
    setError("");
    setLoading(true);
    try {
      setImages(await api.signedImages(task));
    } catch (e) {
      setError(api.readableError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [task.id]);
  async function upload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setBusy(true);
    try {
      await api.uploadImages(task, files);
      await load();
      notify("Đã tải ảnh lên.");
    } catch (e) {
      setError(api.readableError(e));
    } finally {
      setBusy(false);
      input.current.value = "";
    }
  }
  async function remove(image) {
    if (!confirm("Xóa ảnh này khỏi công việc?")) return;
    setBusy(true);
    try {
      await api.removeImage(image.path);
      setImages(images.filter((i) => i.path !== image.path));
    } catch (e) {
      setError(api.readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="image-section">
      <div className="section-line">
        <h3>Hình ảnh công việc</h3>
        {editable && (
          <label className="upload-label">
            <ImageIcon size={16} />
            {busy ? "Đang tải…" : "Thêm ảnh"}
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy}
              onChange={upload}
            />
          </label>
        )}
      </div>
      <p className="muted small">
        JPG, PNG, WebP · Tối đa 10 MB/ảnh · 8 ảnh/lần tải
      </p>
      {error && (
        <div className="notice error">
          {error}
          <button onClick={load}>Thử lại</button>
        </div>
      )}
      {loading ? (
        <p>Đang tải ảnh…</p>
      ) : images.length ? (
        <div className="gallery">
          {images.map((im) => (
            <div key={im.path}>
              <a href={im.url} target="_blank" rel="noreferrer">
                <img src={im.url} alt="Ảnh hiện trường công việc" />
              </a>
              {editable && (
                <button
                  className="icon-button"
                  aria-label="Xóa ảnh"
                  disabled={busy}
                  onClick={() => remove(im)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Chưa có hình ảnh.</p>
      )}
    </section>
  );
}
function Editor({ task, buildings, editable, onClose, onSaved, notify }) {
  const [draft, setDraft] = useState(task),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const saved = await api.saveTask(draft);
      setDraft(saved);
      onSaved(saved);
      notify("Đã cập nhật công việc.");
    } catch (e) {
      setError(api.readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      busy={busy}
      title={editable ? "Chỉnh sửa công việc" : "Chi tiết công việc"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <TaskFields
          draft={draft}
          setDraft={setDraft}
          buildings={buildings}
          editing
          disabled={!editable || busy}
        />
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        <div className="form-actions">
          <span className="muted small">
            Cập nhật: {new Date(draft.updated_at).toLocaleString("vi-VN")}
          </span>
          {editable && (
            <Button className="primary" icon={Check} disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu thay đổi"}
            </Button>
          )}
        </div>
      </form>
      <Images task={task} editable={editable} notify={notify} />
    </Modal>
  );
}
function System({ context, notify }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setData(await api.loadAdmin());
    } catch (e) {
      setError(api.readableError(e));
    }
  }
  useEffect(() => {
    if (context.profile.is_admin) load();
  }, []);
  async function change(user, building, role) {
    setBusy(true);
    setError("");
    try {
      await api.setMember(user, building, role);
      await load();
      notify("Đã cập nhật quyền truy cập.");
    } catch (e) {
      setError(api.readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">QUẢN TRỊ</span>
          <h1>Hệ thống</h1>
          <p>Tài khoản và quyền truy cập theo tòa nhà.</p>
        </div>
      </div>
      <section className="card">
        <h2>Tài khoản của bạn</h2>
        <p>{context.profile.email}</p>
        <Badge
          status={context.profile.is_admin ? "Quản trị viên" : "Nhân sự"}
        />
        <p className="muted">
          {context.buildings.map((b) => b.name).join(" · ") ||
            "Chưa được cấp quyền tòa nhà."}
        </p>
      </section>
      {context.profile.is_admin && (
        <section className="card">
          <h2>Phân quyền nhân sự</h2>
          <p className="muted">
            Chỉ xem: xem và xuất báo cáo. Chỉnh sửa: thêm, sửa, xóa công việc và
            ảnh tại tòa nhà được cấp.
          </p>
          {error && <div className="notice error">{error}</div>}
          {data ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nhân sự</th>
                    {BUILDINGS.map((b) => (
                      <th key={b}>{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.profiles.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.display_name || p.email}</strong>
                        <small>
                          {p.email}
                          {p.is_admin ? " · Quản trị viên" : ""}
                        </small>
                      </td>
                      {BUILDINGS.map((b) => (
                        <td key={b}>
                          {p.is_admin ? (
                            "Toàn quyền"
                          ) : (
                            <Select
                              aria-label={`${p.email} ${b}`}
                              disabled={busy}
                              value={
                                data.members.find(
                                  (m) =>
                                    m.user_id === p.id && m.building_id === b,
                                )?.role || ""
                              }
                              onChange={(e) => change(p.id, b, e.target.value)}
                              options={[
                                { value: "", label: "Không truy cập" },
                                { value: "viewer", label: "Chỉ xem" },
                                { value: "editor", label: "Chỉnh sửa" },
                              ]}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Đang tải nhân sự…</p>
          )}
          <p className="muted small">
            Tài khoản mới được quản trị viên mời trong Supabase Auth. Tài khoản
            chưa có quyền sẽ không xem được dữ liệu.
          </p>
        </section>
      )}
    </>
  );
}
function Report({ tasks, filters, onClose }) {
  const [period, setPeriod] = useState(
      filters.period === "all" ? "month" : filters.period,
    ),
    [anchor, setAnchor] = useState(filters.anchor);
  const rows = filterTasks(tasks, { ...filters, period, anchor });
  const range =
    period === "custom"
      ? [filters.from, filters.to]
      : dateRange(period, anchor);
  return (
    <Modal wide title="Xuất báo cáo PDF" onClose={onClose}>
      <div className="report-controls">
        <label>
          Kỳ báo cáo
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={[
              { value: "day", label: "Ngày" },
              { value: "week", label: "Tuần" },
              { value: "month", label: "Tháng" },
              { value: "all", label: "Tất cả" },
              { value: "custom", label: "Khoảng ngày đang lọc" },
            ]}
          />
        </label>
        {!["all", "custom"].includes(period) && (
          <label>
            Ngày tham chiếu
            <input
              type="date"
              value={anchor}
              required
              onChange={(e) => setAnchor(e.target.value)}
            />
          </label>
        )}
        <Button
          className="primary"
          icon={Download}
          disabled={
            !rows.length || (!anchor && !["all", "custom"].includes(period))
          }
          onClick={() => window.print()}
        >
          In / Lưu PDF
        </Button>
      </div>
      <p className="muted small no-print">
        Báo cáo giữ bộ lọc tòa nhà, tiến độ và từ khóa hiện tại. Chọn “Lưu dưới
        dạng PDF” trong cửa sổ in.
      </p>
      <article className="print-report">
        <div className="report-heading">
          <strong>QLKT5 · BỘ PHẬN KỸ THUẬT</strong>
          <span>{new Date().toLocaleDateString("vi-VN")}</span>
        </div>
        <h1>BÁO CÁO CÔNG VIỆC</h1>
        <p>
          {filters.building || "Tất cả tòa nhà"} ·{" "}
          {range[0]
            ? `${formatDate(range[0])} – ${formatDate(range[1])}`
            : "Toàn bộ thời gian"}{" "}
          · {rows.length} công việc
        </p>
        {(filters.search || filters.status) && (
          <p>
            Bộ lọc: {filters.search && `Từ khóa “${filters.search}”`}{" "}
            {filters.status === "overdue" ? "Quá hạn" : filters.status}
          </p>
        )}
        <table>
          <thead>
            <tr>
              {[
                "STT",
                "Dự án / Công việc",
                "Cấp độ",
                "Thời gian",
                "Người thực hiện",
                "Tiến độ",
                "Ghi chú",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.id}>
                <td>{i + 1}</td>
                <td>
                  <b>{t.building_id}</b>
                  <br />
                  {t.title}
                </td>
                <td>{t.priority}</td>
                <td>
                  {formatDate(t.start_date)}
                  <br />
                  {formatDate(t.end_date)}
                </td>
                <td>{t.assignee || "—"}</td>
                <td>{t.status}</td>
                <td className="pre-wrap">{t.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p>Không có công việc trong kỳ báo cáo này.</p>}
        <footer className="report-footer">
          <span>Người lập báo cáo</span>
          <span>Ban Quản lý</span>
        </footer>
      </article>
    </Modal>
  );
}
function Dashboard({ session }) {
  const [context, setContext] = useState(null),
    [tasks, setTasks] = useState([]),
    [page, setPage] = useState("tasks"),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState(blankTask),
    [files, setFiles] = useState([]),
    [editor, setEditor] = useState(null),
    [deleting, setDeleting] = useState(null),
    [report, setReport] = useState(false),
    [pageNo, setPageNo] = useState(1);
  const [filters, setFilters] = useState({
    search: "",
    building: "",
    status: "",
    period: "all",
    anchor: today(),
    from: "",
    to: "",
  });
  const fileRef = useRef(),
    toastTimer = useRef();
  const notify = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6000);
  };
  const canEdit = (id) =>
    context?.profile.is_admin ||
    context?.members.some((m) => m.building_id === id && m.role === "editor");
  const editableBuildings =
    context?.buildings.filter((b) => canEdit(b.id)) || [];
  async function refresh(initial = false) {
    setLoading(true);
    setLoadError("");
    try {
      const ctx = await api.loadContext(session.user.id);
      const rows = await api.loadTasks();
      setContext(ctx);
      setTasks(rows);
      if (initial) {
        const first = ctx.buildings.find(
          (b) =>
            ctx.profile.is_admin ||
            ctx.members.some(
              (m) => m.building_id === b.id && m.role === "editor",
            ),
        );
        setDraft((d) => ({
          ...d,
          building_id: first?.id || "",
          assignee: ctx.profile.display_name || "",
        }));
      }
    } catch (e) {
      setLoadError(api.readableError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh(true);
    return () => clearTimeout(toastTimer.current);
  }, []);
  useEffect(() => {
    setPageNo(1);
  }, [filters]);
  const filtered = useMemo(() => filterTasks(tasks, filters), [tasks, filters]);
  const pages = Math.max(1, Math.ceil(filtered.length / 25)),
    currentPage = Math.min(pageNo, pages),
    shown = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const updateFilter = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value }));
  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    let saved;
    try {
      validateImages(files);
      saved = await api.saveTask(draft);
      setTasks((t) => [saved, ...t]);
      setDraft({ ...blankTask(), building_id: draft.building_id });
      if (files.length) await api.uploadImages(saved, files);
      setFiles([]);
      fileRef.current.value = "";
      notify("Đã thêm công việc. Bạn có thể nhập công việc tiếp theo.");
    } catch (e) {
      setError(
        (saved
          ? "Công việc đã được lưu, nhưng ảnh chưa tải đầy đủ. Mở công việc để thêm lại ảnh. "
          : "") + api.readableError(e),
      );
      if (saved) {
        setFiles([]);
        fileRef.current.value = "";
        setEditor(saved);
      }
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api.deleteTask(deleting);
      setTasks((t) => t.filter((x) => x.id !== deleting.id));
      setDeleting(null);
      notify("Đã xóa công việc.");
    } catch (e) {
      setError(
        "Xóa chưa hoàn tất. Công việc đang xóa có thể thử lại. " +
          api.readableError(e),
      );
      setDeleting(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e) {
      setError(api.readableError(e));
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Wrench size={23} />
          </span>
          QLKT<span className="brand-five">5</span>
        </a>
        <span className="nav-label">KHÔNG GIAN LÀM VIỆC</span>
        <nav>
          <button
            className={page === "tasks" ? "active" : ""}
            onClick={() => setPage("tasks")}
          >
            <ClipboardList size={19} />
            Công việc<span>01</span>
          </button>
          <button
            className={page === "system" ? "active" : ""}
            onClick={() => setPage("system")}
          >
            <Settings size={19} />
            Hệ thống
          </button>
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">
            {(context?.profile.display_name || session.user.email || "KT")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div>
            <strong>
              {context?.profile.display_name || "Bộ phận Kỹ thuật"}
            </strong>
            <small>{session.user.email}</small>
          </div>
          <button
            aria-label="Đăng xuất"
            className="icon-button"
            onClick={logout}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Không gian làm việc <span className="slash">/</span>{" "}
            <strong>{page === "tasks" ? "Công việc" : "Hệ thống"}</strong>
          </span>
          <span className="today">
            {new Intl.DateTimeFormat("vi-VN", {
              dateStyle: "full",
              timeZone: "Asia/Ho_Chi_Minh",
            }).format(new Date())}
          </span>
        </header>
        <main className="main-content">
          {loadError && (
            <div role="alert" className="notice error">
              {loadError}{" "}
              <button onClick={() => refresh(!context)}>Thử lại</button>
            </div>
          )}
          {error && !deleting && (
            <div role="alert" className="notice error">
              {error}
              <button onClick={() => setError("")}>Đóng</button>
            </div>
          )}
          {page === "system" && context ? (
            <System context={context} notify={notify} />
          ) : (
            <>
              <div className="page-title">
                <div>
                  <span className="eyebrow">QUẢN LÝ VẬN HÀNH</span>
                  <h1>
                    Công việc kỹ thuật<span className="title-dot">.</span>
                  </h1>
                  <p>Theo dõi tiến độ, cập nhật kết quả tại từng tòa nhà.</p>
                </div>
                <Button
                  icon={Download}
                  disabled={loading || !!loadError || !context}
                  onClick={() => setReport(true)}
                >
                  Xuất PDF
                </Button>
              </div>
              {context && !context.buildings.length && (
                <div className="notice">
                  Tài khoản chưa được cấp quyền tòa nhà. Liên hệ quản trị viên
                  để bắt đầu.
                </div>
              )}
              {editableBuildings.length > 0 && (
                <section className="card composer">
                  <div className="section-line">
                    <h2>
                      <span className="small-icon">
                        <Plus size={16} />
                      </span>
                      Thêm công việc
                    </h2>
                    <span className="muted small">
                      Nhập thông tin · Thêm để lưu
                    </span>
                  </div>
                  <form onSubmit={add}>
                    <TaskFields
                      draft={draft}
                      setDraft={setDraft}
                      buildings={editableBuildings}
                      disabled={busy}
                    />
                    <div className="form-actions">
                      <label className="upload-label">
                        <ImageIcon size={16} />
                        {files.length
                          ? `${files.length} ảnh đã chọn`
                          : "Đính kèm hình ảnh"}
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          disabled={busy}
                          onChange={(e) => {
                            try {
                              const list = Array.from(e.target.files);
                              validateImages(list);
                              setFiles(list);
                            } catch (err) {
                              setError(err.message);
                              e.target.value = "";
                              setFiles([]);
                            }
                          }}
                        />
                      </label>
                      <Button className="primary" icon={Plus} disabled={busy}>
                        {busy ? "Đang lưu…" : "Thêm công việc"}
                      </Button>
                    </div>
                  </form>
                </section>
              )}
              <section className="card task-list">
                <div className="list-heading">
                  <h2>
                    Danh sách công việc{" "}
                    <span className="count">{filtered.length}</span>
                  </h2>
                  <button
                    className="icon-button"
                    aria-label="Làm mới danh sách"
                    disabled={loading}
                    onClick={() => refresh()}
                  >
                    <RefreshCw size={17} className={loading ? "spin" : ""} />
                  </button>
                </div>
                <div className="filterbar">
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      aria-label="Tìm kiếm công việc"
                      value={filters.search}
                      onChange={(e) => updateFilter("search", e.target.value)}
                      placeholder="Tìm công việc, người thực hiện, ghi chú…"
                    />
                    {filters.search && (
                      <button
                        aria-label="Xóa từ khóa"
                        className="icon-button"
                        onClick={() => updateFilter("search", "")}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <Select
                    aria-label="Lọc tòa nhà"
                    value={filters.building}
                    onChange={(e) => updateFilter("building", e.target.value)}
                    options={[
                      { value: "", label: "Tất cả tòa nhà" },
                      ...(context?.buildings.map((b) => ({
                        value: b.id,
                        label: b.id,
                      })) || []),
                    ]}
                  />
                  <Select
                    aria-label="Lọc tiến độ"
                    value={filters.status}
                    onChange={(e) => updateFilter("status", e.target.value)}
                    options={[
                      { value: "", label: "Tất cả tiến độ" },
                      ...STATUSES,
                      { value: "overdue", label: "Quá hạn" },
                    ]}
                  />
                </div>
                <div className="date-filters">
                  <div className="segmented">
                    {[
                      ["all", "Tất cả"],
                      ["day", "Ngày"],
                      ["week", "Tuần"],
                      ["month", "Tháng"],
                      ["custom", "Khoảng ngày"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        className={filters.period === value ? "selected" : ""}
                        onClick={() => updateFilter("period", value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {!["all", "custom"].includes(filters.period) && (
                    <input
                      aria-label="Ngày tham chiếu"
                      type="date"
                      value={filters.anchor}
                      onChange={(e) => updateFilter("anchor", e.target.value)}
                    />
                  )}
                  {filters.period === "custom" && (
                    <>
                      <input
                        aria-label="Từ ngày"
                        type="date"
                        value={filters.from}
                        onChange={(e) => updateFilter("from", e.target.value)}
                      />
                      <span>đến</span>
                      <input
                        aria-label="Đến ngày"
                        type="date"
                        min={filters.from}
                        value={filters.to}
                        onChange={(e) => updateFilter("to", e.target.value)}
                      />
                    </>
                  )}
                  <span className="muted small filter-hint">
                    Lọc công việc có thời gian giao với kỳ chọn
                  </span>
                </div>
                {filters.period === "custom" &&
                filters.from &&
                filters.to &&
                filters.to < filters.from ? (
                  <div className="notice error">
                    Ngày kết thúc bộ lọc phải từ ngày bắt đầu trở đi.
                  </div>
                ) : null}
                {loading ? (
                  <div className="empty">
                    <RefreshCw className="spin" />
                    <h3>Đang tải công việc…</h3>
                  </div>
                ) : !filtered.length ? (
                  <div className="empty">
                    <ClipboardList size={36} />
                    <h3>
                      {tasks.length
                        ? "Không tìm thấy công việc"
                        : "Sẵn sàng cho công việc đầu tiên"}
                    </h3>
                    <p>
                      {tasks.length
                        ? "Thử đổi bộ lọc hoặc từ khóa tìm kiếm."
                        : "Thêm công việc ở phía trên để bắt đầu theo dõi."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="table-scroll task-table">
                      <table>
                        <thead>
                          <tr>
                            {[
                              "Dự án",
                              "Tên công việc",
                              "Cấp độ",
                              "Bắt đầu / Kết thúc",
                              "Người thực hiện",
                              "Tiến độ",
                              "Ghi chú",
                              "Thao tác",
                            ].map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map((t) => (
                            <tr key={t.id}>
                              <td data-label="Dự án">
                                <span className="building-badge">
                                  <Building2 size={13} />
                                  {t.building_id}
                                </span>
                              </td>
                              <td data-label="Công việc" className="task-title">
                                <button onClick={() => setEditor(t)}>
                                  {t.title}
                                </button>
                                {t.status !== "Hoàn thành" &&
                                  t.end_date < today() && (
                                    <span className="overdue">Quá hạn</span>
                                  )}
                              </td>
                              <td data-label="Cấp độ">
                                <span
                                  className={`priority priority-${PRIORITIES.indexOf(t.priority)}`}
                                >
                                  {t.priority}
                                </span>
                              </td>
                              <td data-label="Thời gian" className="dates">
                                {formatDate(t.start_date)}
                                <small>{formatDate(t.end_date)}</small>
                              </td>
                              <td data-label="Người thực hiện">
                                {t.assignee || (
                                  <span className="muted">Chưa phân công</span>
                                )}
                              </td>
                              <td data-label="Tiến độ">
                                <Badge
                                  status={
                                    t.deleting_at
                                      ? "Đang xóa · thử lại"
                                      : t.status
                                  }
                                />
                              </td>
                              <td data-label="Ghi chú" className="note-cell">
                                <span>{t.notes || "—"}</span>
                              </td>
                              <td data-label="Thao tác">
                                <div className="row-actions">
                                  <button
                                    aria-label={`Hình ảnh: ${t.title}`}
                                    title="Chi tiết và hình ảnh"
                                    className="icon-button"
                                    onClick={() => setEditor(t)}
                                  >
                                    <ImageIcon size={16} />
                                  </button>
                                  {canEdit(t.building_id) && (
                                    <>
                                      <button
                                        aria-label={`Sửa: ${t.title}`}
                                        className="icon-button"
                                        onClick={() => setEditor(t)}
                                        disabled={!!t.deleting_at}
                                      >
                                        <Pencil size={16} />
                                      </button>
                                      <button
                                        aria-label={`Xóa: ${t.title}`}
                                        className="icon-button danger"
                                        onClick={() => {
                                          setError("");
                                          setDeleting(t);
                                        }}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="pagination">
                      <span>
                        {(currentPage - 1) * 25 + 1}–
                        {Math.min(currentPage * 25, filtered.length)} /{" "}
                        {filtered.length} công việc
                      </span>
                      <div>
                        <button
                          className="icon-button"
                          aria-label="Trang trước"
                          disabled={currentPage <= 1}
                          onClick={() => setPageNo(currentPage - 1)}
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <span>
                          Trang {currentPage} / {pages}
                        </span>
                        <button
                          className="icon-button"
                          aria-label="Trang sau"
                          disabled={currentPage >= pages}
                          onClick={() => setPageNo(currentPage + 1)}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
              <footer className="app-footer">
                <span>QLKT5 · Quản lý kỹ thuật tòa nhà</span>
                <span>Thời gian theo múi giờ Việt Nam</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {editor && (
        <Editor
          task={editor}
          buildings={context.buildings}
          editable={canEdit(editor.building_id) && !editor.deleting_at}
          onClose={() => setEditor(null)}
          onSaved={(saved) => {
            setTasks((t) => t.map((x) => (x.id === saved.id ? saved : x)));
            setEditor(saved);
          }}
          notify={notify}
        />
      )}
      {deleting && (
        <Modal
          title="Xóa công việc?"
          busy={busy}
          onClose={() => setDeleting(null)}
        >
          <p>
            <strong>{deleting.title}</strong>
          </p>
          <p>
            Công việc và toàn bộ hình ảnh đính kèm sẽ bị xóa. Thao tác này không
            thể hoàn tác.
          </p>
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          <div className="form-actions">
            <Button disabled={busy} onClick={() => setDeleting(null)}>
              Hủy
            </Button>
            <Button
              className="danger-fill"
              disabled={busy}
              icon={Trash2}
              onClick={remove}
            >
              {busy ? "Đang xóa…" : "Xóa công việc"}
            </Button>
          </div>
        </Modal>
      )}
      {report && (
        <Report
          tasks={tasks}
          filters={filters}
          onClose={() => setReport(false)}
        />
      )}
    </div>
  );
}
function App() {
  const [session, setSession] = useState(null),
    [ready, setReady] = useState(!configured),
    [recovery, setRecovery] = useState(
      new URLSearchParams(location.search).has("recovery"),
    );
  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setReady(true);
      })
      .catch(() => setReady(true));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setReady(true);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  if (!ready) return <div className="boot">Đang kết nối QLKT5…</div>;
  if (!session || recovery)
    return (
      <Auth
        recovery={!!session && recovery}
        onRecovered={() => {
          setRecovery(false);
          history.replaceState({}, "", location.pathname);
        }}
      />
    );
  return <Dashboard key={session.user.id} session={session} />;
}
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="boot">
        <h1>Không thể hiển thị trang.</h1>
        <p>Vui lòng tải lại để kết nối lại dữ liệu.</p>
        <Button onClick={() => location.reload()}>Tải lại</Button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export { App, Dashboard, Auth };
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
