import test from "node:test";
import assert from "node:assert/strict";
import {
  dateRange,
  today,
  filterTasks,
  blankTask,
  validateTask,
  validateImages,
} from "../src/domain.js";
test("Vietnam date rolls over independently of host timezone", () =>
  assert.equal(today(new Date("2026-09-20T18:00:00Z")), "2026-09-21"));
test("week starts Monday and crosses the year", () =>
  assert.deepEqual(dateRange("week", "2026-01-01"), [
    "2025-12-29",
    "2026-01-04",
  ]));
test("month includes leap day", () =>
  assert.deepEqual(dateRange("month", "2024-02-19"), [
    "2024-02-01",
    "2024-02-29",
  ]));
test("filters include overlapping tasks and Vietnamese unaccented search", () => {
  const a = {
    ...blankTask(),
    title: "Kiểm tra điện",
    start_date: "2026-09-01",
    end_date: "2026-10-05",
    notes: "Tầng 6",
  };
  const b = { ...a, building_id: "62THL" };
  assert.deepEqual(
    filterTasks([a, b], {
      period: "week",
      anchor: "2026-09-21",
      building: "68PĐL",
      search: "dien",
    }),
    [a],
  );
  assert.equal(
    filterTasks([a], { period: "day", anchor: "2026-11-01" }).length,
    0,
  );
});
test("invalid dates, titles, priorities and upload types are rejected", () => {
  assert.throws(() => validateTask({ ...blankTask(), title: " " }));
  assert.throws(() =>
    validateTask({
      ...blankTask(),
      title: "ABC",
      start_date: "2026-10-02",
      end_date: "2026-10-01",
    }),
  );
  assert.throws(() =>
    validateTask({ ...blankTask(), title: "ABC", priority: "root" }),
  );
  assert.throws(() => validateImages([{ type: "image/svg+xml", size: 10 }]));
  assert.throws(() => validateImages([{ type: "image/png", size: 10485761 }]));
  assert.throws(() =>
    validateImages(Array(9).fill({ type: "image/png", size: 1 })),
  );
});

test("cleared date and inverted custom range never export all records", () => {
  const row = { ...blankTask(), title: "test" };
  assert.equal(filterTasks([row], { period: "day", anchor: "" }).length, 0);
  assert.equal(
    filterTasks([row], {
      period: "custom",
      from: "2026-10-01",
      to: "2026-09-01",
    }).length,
    0,
  );
});
