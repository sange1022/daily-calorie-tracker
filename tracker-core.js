const numberValue = (value) => Number.parseFloat(value) || 0;
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const validMeals = new Set(["morning", "noon", "evening"]);
const pinyinCollator = new Intl.Collator("zh-CN-u-co-pinyin", {
  numeric: true,
  sensitivity: "base",
});

export function collectOpenMealIds(details = []) {
  return new Set(
    [...details]
      .filter((detail) => detail.open && detail.dataset?.meal)
      .map((detail) => detail.dataset.meal),
  );
}

function normalizeStamp(value = {}) {
  return {
    updatedAt: numberValue(value.updatedAt),
    updatedBy: String(value.updatedBy || ""),
  };
}

function normalizeTombstones(value = {}) {
  return Object.fromEntries(
    Object.entries(value || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, stamp]) => [id, normalizeStamp(stamp)]),
  );
}

export function inferFoodCategory(food) {
  return numberValue(food.protein) > numberValue(food.carb) ? "protein" : "carb";
}

export function normalizeFood(item = {}) {
  const food = {
    id: item.id || uid(),
    name: String(item.name || "未命名食物"),
    carb: numberValue(item.carb),
    protein: numberValue(item.protein),
    fat: numberValue(item.fat),
    kcal: numberValue(item.kcal),
    updatedAt: numberValue(item.updatedAt),
    updatedBy: String(item.updatedBy || ""),
  };
  food.category = ["carb", "protein"].includes(item.category)
    ? item.category
    : inferFoodCategory(food);
  return food;
}

export function normalizeDailyRow(row = {}) {
  const portion = Math.max(numberValue(row.portion) || 1, 0.1);
  const hasBaseValues = ["baseCarb", "baseProtein", "baseFat", "baseKcal"].some(
    (key) => row[key] !== undefined,
  );
  const divisor = hasBaseValues ? 1 : portion;
  return {
    id: row.id || uid(),
    foodId: row.foodId || "",
    meal: validMeals.has(row.meal) ? row.meal : "morning",
    name: String(row.name || "未命名食物"),
    portion,
    baseCarb: numberValue(hasBaseValues ? row.baseCarb : row.carb) / divisor,
    baseProtein: numberValue(hasBaseValues ? row.baseProtein : row.protein) / divisor,
    baseFat: numberValue(hasBaseValues ? row.baseFat : row.fat) / divisor,
    baseKcal: numberValue(hasBaseValues ? row.baseKcal : row.kcal) / divisor,
    carb: numberValue(row.carb),
    protein: numberValue(row.protein),
    fat: numberValue(row.fat),
    kcal: numberValue(row.kcal),
    updatedAt: numberValue(row.updatedAt),
    updatedBy: String(row.updatedBy || ""),
  };
}

export function updateRowPortion(row, portion) {
  const nextPortion = Math.max(numberValue(portion), 0.1);
  row.portion = nextPortion;
  row.carb = numberValue((row.baseCarb * nextPortion).toFixed(2));
  row.protein = numberValue((row.baseProtein * nextPortion).toFixed(2));
  row.fat = numberValue((row.baseFat * nextPortion).toFixed(2));
  row.kcal = numberValue((row.baseKcal * nextPortion).toFixed(1));
  return row;
}

export function sortFoodsByName(foods) {
  return [...foods].sort((left, right) =>
    pinyinCollator.compare(String(left.name || ""), String(right.name || "")),
  );
}

export function sumNutrition(rows) {
  return rows.reduce(
    (sum, row) => {
      sum.carb += numberValue(row.carb);
      sum.protein += numberValue(row.protein);
      sum.fat += numberValue(row.fat);
      sum.kcal += numberValue(row.kcal);
      return sum;
    },
    { carb: 0, protein: 0, fat: 0, kcal: 0 },
  );
}

export function normalizeTrackerState(imported, defaults = {}) {
  if (!imported || typeof imported !== "object") return null;
  if (!imported.settings || !Array.isArray(imported.library) || !imported.days) return null;
  return {
    ...structuredClone(defaults),
    ...imported,
    labels: { ...(defaults.labels || {}), ...(imported.labels || {}) },
    settings: { ...(defaults.settings || {}), ...imported.settings },
    library: imported.library.map(normalizeFood),
    days: Object.fromEntries(
      Object.entries(imported.days || {}).map(([date, rows]) => [
        date,
        Array.isArray(rows) ? rows.map(normalizeDailyRow) : [],
      ]),
    ),
    syncMeta: {
      foodTombstones: normalizeTombstones(imported.syncMeta?.foodTombstones),
      rowTombstones: normalizeTombstones(imported.syncMeta?.rowTombstones),
      settings: normalizeStamp(imported.syncMeta?.settings),
      labels: normalizeStamp(imported.syncMeta?.labels),
    },
  };
}

function compareStamps(left, right) {
  const timeDifference = numberValue(left?.updatedAt) - numberValue(right?.updatedAt);
  if (timeDifference) return timeDifference;
  return String(left?.updatedBy || "").localeCompare(String(right?.updatedBy || ""));
}

function compareVersions(left, right) {
  const stampDifference = compareStamps(left, right);
  if (stampDifference) return stampDifference;
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

function mergeEntities(leftItems, rightItems, normalize) {
  const entities = new Map();
  [...leftItems, ...rightItems].forEach((item) => {
    const normalized = normalize(item);
    const current = entities.get(normalized.id);
    if (!current || compareVersions(normalized, current) > 0) entities.set(normalized.id, normalized);
  });
  return [...entities.values()].sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function mergeTombstones(left, right) {
  const ids = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  return Object.fromEntries(ids.map((id) => {
    const local = left[id];
    const remote = right[id];
    return [id, !local || (remote && compareVersions(remote, local) > 0) ? remote : local];
  }));
}

function chooseVersionedValue(leftValue, leftStamp, rightValue, rightStamp) {
  const stampDifference = compareStamps(leftStamp, rightStamp);
  if (stampDifference !== 0) return stampDifference > 0 ? leftValue : rightValue;
  return JSON.stringify(leftValue).localeCompare(JSON.stringify(rightValue)) >= 0 ? leftValue : rightValue;
}

export function mergeTrackerStates(left, right, defaults = {}) {
  const local = normalizeTrackerState(left, defaults);
  const remote = normalizeTrackerState(right, defaults);
  if (!local) return remote;
  if (!remote) return local;

  const foodTombstones = mergeTombstones(
    local.syncMeta.foodTombstones,
    remote.syncMeta.foodTombstones,
  );
  const rowTombstones = mergeTombstones(
    local.syncMeta.rowTombstones,
    remote.syncMeta.rowTombstones,
  );
  const dates = [...new Set([...Object.keys(local.days), ...Object.keys(remote.days)])].sort();
  const days = Object.fromEntries(dates.map((date) => [
    date,
    mergeEntities(local.days[date] || [], remote.days[date] || [], normalizeDailyRow)
      .filter((row) => !rowTombstones[row.id] || compareStamps(row, rowTombstones[row.id]) > 0),
  ]));

  const settings = chooseVersionedValue(
    local.settings,
    local.syncMeta.settings,
    remote.settings,
    remote.syncMeta.settings,
  );
  const labels = chooseVersionedValue(
    local.labels,
    local.syncMeta.labels,
    remote.labels,
    remote.syncMeta.labels,
  );

  return {
    ...local,
    settings,
    labels,
    library: mergeEntities(local.library, remote.library, normalizeFood)
      .filter((food) => !foodTombstones[food.id] || compareStamps(food, foodTombstones[food.id]) > 0),
    days,
    syncMeta: {
      foodTombstones,
      rowTombstones,
      settings: compareVersions(local.syncMeta.settings, remote.syncMeta.settings) >= 0
        ? local.syncMeta.settings
        : remote.syncMeta.settings,
      labels: compareVersions(local.syncMeta.labels, remote.syncMeta.labels) >= 0
        ? local.syncMeta.labels
        : remote.syncMeta.labels,
    },
  };
}
