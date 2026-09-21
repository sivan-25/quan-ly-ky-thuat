// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import { blankTask } from "../src/domain";
const mocks = vi.hoisted(() => ({
  loadContext: vi.fn(),
  loadTasks: vi.fn(),
  saveTask: vi.fn(),
  uploadImages: vi.fn(),
  deleteTask: vi.fn(),
  signedImages: vi.fn(),
  loadAdmin: vi.fn(),
  setMember: vi.fn(),
  readableError: (e) => e.message,
}));
vi.mock("../src/api", () => mocks);
vi.mock("../src/supabase", () => ({
  configured: true,
  supabase: {
    auth: {
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));
import { Dashboard, Auth } from "../src/main";
const row = {
  ...blankTask(),
  id: "test-task",
  title: "Kiểm tra máy lạnh",
  notes: "Ghi chú tầng 6",
  assignee: "Kỹ thuật A",
  updated_at: "2026-09-21T00:00:00Z",
  created_at: "2026-09-21T00:00:00Z",
};
const context = {
  profile: {
    email: "qa@example.invalid",
    is_admin: true,
    display_name: "Kiểm thử",
  },
  buildings: [
    { id: "68PĐL", name: "L’MAK 68" },
    { id: "62THL", name: "62 Trần Huy Liệu" },
  ],
  members: [],
};
const session = { user: { id: "test-user", email: "qa@example.invalid" } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadContext.mockResolvedValue(context);
  mocks.loadTasks.mockResolvedValue([row]);
  mocks.signedImages.mockResolvedValue([]);
  mocks.uploadImages.mockResolvedValue();
  mocks.deleteTask.mockResolvedValue();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => cleanup());
async function open() {
  render(<Dashboard session={session} />);
  await screen.findByRole("button", { name: row.title, exact: true });
}
describe("Management UI against simulated API", () => {
  it("adds a task, clears the input only after success, and renders the saved row", async () => {
    await open();
    mocks.saveTask.mockImplementation(async (d) => ({
      ...d,
      id: "new-task",
      updated_at: row.updated_at,
    }));
    fireEvent.change(screen.getByLabelText(/Tên công việc/), {
      target: { value: "Bảo trì bơm" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Thêm công việc", exact: true }),
    );
    await screen.findByRole("button", { name: "Bảo trì bơm", exact: true });
    expect(screen.getByLabelText(/Tên công việc/).value).toBe("");
    expect(mocks.saveTask).toHaveBeenCalledTimes(1);
  });
  it("preserves draft on network failure", async () => {
    await open();
    mocks.saveTask.mockRejectedValue(new Error("Mất kết nối"));
    fireEvent.change(screen.getByLabelText(/Tên công việc/), {
      target: { value: "Bản nhập chưa lưu" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Thêm công việc", exact: true }),
    );
    await screen.findByRole("alert");
    expect(screen.getByLabelText(/Tên công việc/).value).toBe(
      "Bản nhập chưa lưu",
    );
  });
  it("searches Vietnamese without accents and filters buildings", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Tìm kiếm công việc"), {
      target: { value: "may lanh" },
    });
    expect(
      screen.getByRole("button", { name: row.title, exact: true }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Lọc tòa nhà"), {
      target: { value: "62THL" },
    });
    expect(screen.getByText("Không tìm thấy công việc")).toBeTruthy();
  });
  it("updates note and title from edit dialog", async () => {
    await open();
    mocks.saveTask.mockImplementation(async (d) => ({
      ...d,
      updated_at: "2026-09-21T01:00:00Z",
    }));
    fireEvent.click(screen.getByRole("button", { name: "Sửa: " + row.title }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Tên công việc/), {
      target: { value: "Đã kiểm tra máy lạnh" },
    });
    fireEvent.change(within(dialog).getByLabelText("Ghi chú"), {
      target: { value: "Nhiệt độ đạt" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
    );
    await waitFor(() => expect(mocks.saveTask).toHaveBeenCalled());
    await screen.findByRole("button", {
      name: "Đã kiểm tra máy lạnh",
      exact: true,
    });
  });
  it("requires explicit delete confirmation and removes the row on success", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Xóa: " + row.title }));
    expect(mocks.deleteTask).not.toHaveBeenCalled();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Xóa công việc",
      }),
    );
    await screen.findByText("Sẵn sàng cho công việc đầu tiên");
    expect(mocks.deleteTask).toHaveBeenCalledWith(row);
  });
  it("viewer cannot see add, edit, or delete controls", async () => {
    mocks.loadContext.mockResolvedValue({
      ...context,
      profile: { ...context.profile, is_admin: false },
      members: [{ building_id: "68PĐL", role: "viewer" }],
    });
    await open();
    expect(
      screen.queryByRole("button", { name: "Thêm công việc", exact: true }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Sửa: " + row.title }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Xóa: " + row.title }),
    ).toBeNull();
  });
  it("exports all filtered rows, including beyond the current page", async () => {
    mocks.loadTasks.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({
        ...row,
        id: "task-" + i,
        title: "Công việc số " + i,
      })),
    );
    render(<Dashboard session={session} />);
    await screen.findByRole("button", { name: "Công việc số 0", exact: true });
    fireEvent.click(screen.getByRole("button", { name: "Xuất PDF" }));
    expect(
      within(screen.getByRole("dialog")).getByText("Công việc số 29"),
    ).toBeTruthy();
  });
});
