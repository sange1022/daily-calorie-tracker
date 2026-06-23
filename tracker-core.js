const numberValue = (value) => Number.parseFloat(value) || 0;
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const validMeals = new Set(["morning", "noon", "evening"]);
const pinyinCollator = new Intl.Collator("zh-CN-u-co-pinyin", {
  numeric: true,
  sensitivity: "base",
});

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
  };
}
