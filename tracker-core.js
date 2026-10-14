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

export function updateFoodName(food, name) {
  const nextName = String(name || "").trim();
  if (!nextName || nextName === food.name) return false;
  food.name = nextName;
  return true;
}

export function normalizeFood(item = {}) {
  const food = {
    id: item.id || uid(),
    name: String(item.name || "未命名食物"),
    carb: numberValue(item.carb),
    protein: numberValue(item.protein),
    fat: numberValue(item.fat),
    kcal: numberValue(item.kcal),
    gramsPerPortion: Math.max(0, numberValue(item.gramsPerPortion)),
    updatedAt: numberValue(item.updatedAt),
    updatedBy: String(item.updatedBy || ""),
  };
  food.category = ["carb", "protein"].includes(item.category)
    ? item.category
    : inferFoodCategory(food);
  return food;
}

export function normalizeDailyRow(row = {}) {
  const gramsPerPortion = Math.max(0, numberValue(row.gramsPerPortion));
  const unit = row.unit === "g" && gramsPerPortion > 0 ? "g" : "portion";
  const minimum = unit === "g" ? 0.1 / gramsPerPortion : 0.1;
  const portion = Math.max(numberValue(row.portion) || 1, minimum);
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
    unit,
    gramsPerPortion,
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
  const minimum = row.unit === "g" && row.gramsPerPortion > 0 ? 0.1 / row.gramsPerPortion : 0.1;
  const nextPortion = Math.max(numberValue(portion), minimum);
  row.portion = nextPortion;
  row.carb = numberValue((row.baseCarb * nextPortion).toFixed(2));
  row.protein = numberValue((row.baseProtein * nextPortion).toFixed(2));
  row.fat = numberValue((row.baseFat * nextPortion).toFixed(2));
  row.kcal = numberValue((row.baseKcal * nextPortion).toFixed(1));
  return row;
}

export function stepPortionAmount(value, direction) {
  const parsed = Number(value);
  const current = Number.isFinite(parsed) ? parsed : 1;
  const next = direction > 0
    ? (Math.floor(current * 2 + 1e-8) + 1) / 2
    : (Math.ceil(current * 2 - 1e-8) - 1) / 2;
  return Math.max(0.5, next);
}

export function normalizePreset(preset = {}) {
  return {
    id: preset.id || uid(),
    name: String(preset.name || "未命名套餐"),
    meal: validMeals.has(preset.meal) ? preset.meal : "morning",
    items: (Array.isArray(preset.items) ? preset.items : []).map((item) => ({
      foodId: String(item.foodId || item.food?.id || ""),
      food: normalizeFood(item.food || { id: item.foodId }),
      amount: numberValue(item.amount),
      unit: item.unit === "g" ? "g" : "portion",
    })),
    ...normalizeStamp(preset),
  };
}

export function buildPresetRows(preset, library = [], options = {}) {
  const multiplier = options.multiplier ?? 1;
  if (!Number.isFinite(multiplier) || multiplier < 0.1) throw new Error("套餐份数需大于或等于 0.1");
  if (!preset.items?.length) throw new Error("请选择套餐里的食物");
  return preset.items.map((item) => {
    const food = library.find((entry) => entry.id === item.foodId) || item.food;
    if (!food) throw new Error("套餐食物已不存在，请编辑套餐");
    if (!Number.isFinite(item.amount) || item.amount < 0.1) throw new Error(`${food.name}的用量需大于或等于 0.1`);
    const gramsPerPortion = numberValue(food.gramsPerPortion);
    if (item.unit === "g" && (!Number.isFinite(gramsPerPortion) || gramsPerPortion <= 0)) throw new Error(`请设置${food.name}的每份重量`);
    const amount = item.amount * multiplier;
    const portion = item.unit === "g" ? amount / gramsPerPortion : amount;
    const row = {
      id: uid(), foodId: food.id, name: food.name,
      meal: validMeals.has(options.meal) ? options.meal : preset.meal,
      unit: item.unit === "g" ? "g" : "portion", gramsPerPortion,
      baseCarb: food.carb, baseProtein: food.protein, baseFat: food.fat, baseKcal: food.kcal,
    };
    return updateRowPortion(row, portion);
  });
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
    presets: (Array.isArray(imported.presets) ? imported.presets : []).map(normalizePreset),
    days: Object.fromEntries(
      Object.entries(imported.days || {}).map(([date, rows]) => [
        date,
        Array.isArray(rows) ? rows.map(normalizeDailyRow) : [],
      ]),
    ),
    syncMeta: {
      foodTombstones: normalizeTombstones(imported.syncMeta?.foodTombstones),
      rowTombstones: normalizeTombstones(imported.syncMeta?.rowTombstones),
      presetTombstones: normalizeTombstones(imported.syncMeta?.presetTombstones),
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
  const presetTombstones = mergeTombstones(local.syncMeta.presetTombstones, remote.syncMeta.presetTombstones);
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
    presets: mergeEntities(local.presets, remote.presets, normalizePreset)
      .filter((preset) => !presetTombstones[preset.id] || compareStamps(preset, presetTombstones[preset.id]) > 0),
    days,
    syncMeta: {
      foodTombstones,
      rowTombstones,
      presetTombstones,
      settings: compareVersions(local.syncMeta.settings, remote.syncMeta.settings) >= 0
        ? local.syncMeta.settings
        : remote.syncMeta.settings,
      labels: compareVersions(local.syncMeta.labels, remote.syncMeta.labels) >= 0
        ? local.syncMeta.labels
        : remote.syncMeta.labels,
    },
  };
}
