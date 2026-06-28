import assert from "node:assert/strict";
import test from "node:test";

import {
  inferFoodCategory,
  mergeTrackerStates,
  normalizeDailyRow,
  normalizeTrackerState,
  sortFoodsByName,
  sumNutrition,
  updateRowPortion,
} from "../tracker-core.js";

test("infers the dominant macro category", () => {
  assert.equal(inferFoodCategory({ carb: 23, protein: 1.1 }), "carb");
  assert.equal(inferFoodCategory({ carb: 0, protein: 31 }), "protein");
  assert.equal(inferFoodCategory({ carb: 10, protein: 10 }), "carb");
});

test("migrates a legacy row as one portion without changing totals", () => {
  const row = normalizeDailyRow({
    id: "legacy",
    meal: "noon",
    name: "米饭",
    carb: 26,
    protein: 2.6,
    fat: 0.3,
    kcal: 116,
  });

  assert.equal(row.portion, 1);
  assert.equal(row.baseCarb, 26);
  assert.equal(row.baseProtein, 2.6);
  assert.equal(row.kcal, 116);
});

test("recalculates nutrients when the portion changes", () => {
  const row = normalizeDailyRow({
    name: "鸡蛋",
    carb: 2,
    protein: 7,
    fat: 5,
    kcal: 70,
  });

  updateRowPortion(row, 2.5);

  assert.deepEqual(
    { portion: row.portion, carb: row.carb, protein: row.protein, fat: row.fat, kcal: row.kcal },
    { portion: 2.5, carb: 5, protein: 17.5, fat: 12.5, kcal: 175 },
  );
});

test("normalizes old tracker data while preserving counts and totals", () => {
  const state = normalizeTrackerState({
    settings: { weight: 95 },
    labels: {},
    library: [
      { id: "rice", name: "生米", carb: 78, protein: 7, fat: 0.8, kcal: 345 },
      { id: "chicken", name: "鸡胸肉", carb: 0, protein: 31, fat: 3.6, kcal: 165 },
    ],
    days: {
      "2026-06-22": [
        { id: "a", meal: "morning", name: "生米", carb: 78, protein: 7, fat: 0.8, kcal: 345 },
        { id: "b", meal: "noon", name: "鸡胸肉", carb: 0, protein: 31, fat: 3.6, kcal: 165 },
      ],
    },
  });

  assert.equal(state.library.length, 2);
  assert.equal(state.library[0].category, "carb");
  assert.equal(state.library[1].category, "protein");
  assert.equal(state.days["2026-06-22"].length, 2);
  assert.equal(state.days["2026-06-22"].reduce((sum, row) => sum + row.kcal, 0), 510);
});

test("sorts Chinese food names by pinyin from A to Z", () => {
  const foods = [
    { name: "鸡蛋" },
    { name: "香蕉" },
    { name: "蓝莓" },
    { name: "包子" },
  ];

  assert.deepEqual(sortFoodsByName(foods).map((food) => food.name), [
    "包子",
    "鸡蛋",
    "蓝莓",
    "香蕉",
  ]);
});

test("sums all nutrition values for a meal header", () => {
  assert.deepEqual(
    sumNutrition([
      { carb: 10, protein: 5, fat: 2, kcal: 80 },
      { carb: 3.5, protein: 7, fat: 4, kcal: 100 },
    ]),
    { carb: 13.5, protein: 12, fat: 6, kcal: 180 },
  );
});

test("merges unique foods and daily rows from both devices", () => {
  const local = {
    settings: { weight: 90 },
    labels: {},
    library: [{ id: "local-food", name: "米饭", carb: 26, updatedAt: 10, updatedBy: "A" }],
    days: {
      "2026-06-28": [
        { id: "local-row", name: "米饭", meal: "noon", kcal: 116, updatedAt: 10, updatedBy: "A" },
      ],
    },
  };
  const remote = {
    settings: { weight: 90 },
    labels: {},
    library: [{ id: "remote-food", name: "鸡蛋", protein: 7, updatedAt: 11, updatedBy: "B" }],
    days: {
      "2026-06-28": [
        { id: "remote-row", name: "米饭", meal: "noon", kcal: 116, updatedAt: 11, updatedBy: "B" },
      ],
    },
  };

  const merged = mergeTrackerStates(local, remote);

  assert.deepEqual(merged.library.map((food) => food.id), ["local-food", "remote-food"]);
  assert.deepEqual(merged.days["2026-06-28"].map((row) => row.id), ["local-row", "remote-row"]);
});

test("keeps the newest edit when both devices contain the same entity ID", () => {
  const local = {
    settings: { weight: 90 },
    labels: {},
    library: [{ id: "egg", name: "鸡蛋", protein: 7, updatedAt: 10, updatedBy: "A" }],
    days: {},
  };
  const remote = {
    settings: { weight: 90 },
    labels: {},
    library: [{ id: "egg", name: "水煮蛋", protein: 8, updatedAt: 20, updatedBy: "B" }],
    days: {},
  };

  const merged = mergeTrackerStates(local, remote);

  assert.equal(merged.library.length, 1);
  assert.equal(merged.library[0].name, "水煮蛋");
  assert.equal(merged.library[0].protein, 8);
});

test("propagates newer food and daily-row deletions without stale resurrection", () => {
  const local = {
    settings: { weight: 90 },
    labels: {},
    library: [{ id: "egg", name: "鸡蛋", updatedAt: 10, updatedBy: "A" }],
    days: {
      "2026-06-28": [{ id: "breakfast", name: "鸡蛋", meal: "morning", updatedAt: 10, updatedBy: "A" }],
    },
    syncMeta: { foodTombstones: {}, rowTombstones: {} },
  };
  const remote = {
    settings: { weight: 90 },
    labels: {},
    library: [],
    days: {},
    syncMeta: {
      foodTombstones: { egg: { updatedAt: 20, updatedBy: "B" } },
      rowTombstones: { breakfast: { updatedAt: 20, updatedBy: "B" } },
    },
  };

  const merged = mergeTrackerStates(local, remote);

  assert.equal(merged.library.some((food) => food.id === "egg"), false);
  assert.equal(merged.days["2026-06-28"].some((row) => row.id === "breakfast"), false);
  assert.equal(merged.syncMeta.foodTombstones.egg.updatedAt, 20);
  assert.equal(merged.syncMeta.rowTombstones.breakfast.updatedAt, 20);
});

test("keeps a live entity when it is newer than its deletion tombstone", () => {
  const local = {
    settings: { weight: 90 },
    labels: {},
    library: [{ id: "egg", name: "新鸡蛋", updatedAt: 30, updatedBy: "A" }],
    days: {},
    syncMeta: { foodTombstones: {}, rowTombstones: {} },
  };
  const remote = {
    settings: { weight: 90 },
    labels: {},
    library: [],
    days: {},
    syncMeta: {
      foodTombstones: { egg: { updatedAt: 20, updatedBy: "B" } },
      rowTombstones: {},
    },
  };

  assert.equal(mergeTrackerStates(local, remote).library[0].name, "新鸡蛋");
});

test("uses version metadata to resolve settings and produces stable merges", () => {
  const local = {
    settings: { weight: 90, carbFactor: 2.5 },
    labels: {},
    library: [],
    days: {},
    syncMeta: {
      foodTombstones: {}, rowTombstones: {},
      settings: { updatedAt: 10, updatedBy: "A" },
      labels: { updatedAt: 0, updatedBy: "" },
    },
  };
  const remote = {
    settings: { weight: 92, carbFactor: 2.2 },
    labels: {},
    library: [],
    days: {},
    syncMeta: {
      foodTombstones: {}, rowTombstones: {},
      settings: { updatedAt: 20, updatedBy: "B" },
      labels: { updatedAt: 0, updatedBy: "" },
    },
  };

  const merged = mergeTrackerStates(local, remote);

  assert.equal(merged.settings.weight, 92);
  assert.deepEqual(mergeTrackerStates(remote, local), merged);
  assert.deepEqual(mergeTrackerStates(merged, remote), merged);
});
