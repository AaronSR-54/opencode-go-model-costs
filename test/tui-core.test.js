import { test } from "node:test";
import assert from "node:assert/strict";
import {
  UNLIMITED,
  buildCostItems,
  buildLimitIndex,
  clipName,
  costColorKey,
  isActiveModel,
  loadUsageLimits,
  matchKey,
  normalizeModel,
  normalizeModelId,
  parseLimitsFromMarkdown,
  parseUsageLimits,
  v1Theme,
  v2Theme,
} from "../tui-core.js";

function model(overrides = {}) {
  return { name: "Model", cost: { input: 1, output: 1 }, release_date: "2025-01-01", ...overrides };
}

const LIMITS = {
  "minimax-m2.7": 100,
  cheap: 1000,
  pricey: 10,
  "free-model": UNLIMITED,
};

const MODELS = {
  "minimax-m2.7": model({ name: "MiniMax M2.7" }),
  cheap: model({ name: "Cheap" }),
  pricey: model({ name: "Pricey", cost: { input: 10, output: 10 } }),
  "free-model": model({ name: "Free" }),
  nodata: { name: "NoData", release_date: "2025-01-01" },
};

test("buildCostItems orders models by quota burn rate and sorts unknown last", () => {
  const { items, baseline } = buildCostItems({ providers: [{ id: "opencode-go", models: MODELS }], limits: LIMITS });
  assert.equal(baseline, 1.3 / 100);
  assert.deepEqual(
    items.map((i) => i.id),
    ["free-model", "cheap", "minimax-m2.7", "pricey", "nodata"]
  );
});

test("buildCostItems formats the multiplier relative to the baseline model", () => {
  const { items } = buildCostItems({ providers: [{ id: "opencode-go", models: MODELS }], limits: LIMITS });
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId["minimax-m2.7"].mult, "1.0x");
  assert.equal(byId.cheap.mult, "0.1x");
  assert.equal(byId.pricey.mult, "100x");
});

test("buildCostItems shows `?` when a model has no price or no usage limit", () => {
  const { items } = buildCostItems({ providers: [{ id: "opencode-go", models: MODELS }], limits: LIMITS });
  const nodata = items.find((i) => i.id === "nodata");
  assert.equal(nodata.mult, "?");
  assert.equal(nodata.burn, null);
  assert.equal(nodata.score, null);
});

test("buildCostItems shows `0.0x` for free/unlimited models", () => {
  const { items } = buildCostItems({ providers: [{ id: "opencode-go", models: MODELS }], limits: LIMITS });
  assert.equal(items.find((i) => i.id === "free-model").mult, "0.0x");
});

test("buildCostItems marks models released in the last 30 days with `recent`", () => {
  const models = {
    newest: model({ name: "Newest", release_date: "2025-03-15" }),
    oldest: model({ name: "Oldest", release_date: "2025-01-01" }),
  };
  const { items } = buildCostItems({ providers: [{ id: "opencode-go", models }], limits: LIMITS });
  assert.equal(items.find((i) => i.id === "newest").recent, true);
  assert.equal(items.find((i) => i.id === "oldest").recent, false);
});

test("costColorKey maps the burn thresholds to green/yellow/red", () => {
  assert.equal(costColorKey(0.5), "success");
  assert.equal(costColorKey(1.5), "success");
  assert.equal(costColorKey(2), "warning");
  assert.equal(costColorKey(5), "warning");
  assert.equal(costColorKey(5.1), "error");
  assert.equal(costColorKey(99), "error");
});

test("normalizeModelId and matchKey reconcile docs names with catalog ids", () => {
  assert.equal(normalizeModelId("DeepSeek V4.1 Flash (Off-Peak)"), "deepseek-v4.1-flash");
  assert.equal(matchKey("Claude Haiku 5.5"), "claude-haiku-5-5");
});

test("buildLimitIndex normalizes separator differences", () => {
  const index = buildLimitIndex({ "claude-haiku-5.5": 40 });
  assert.equal(index["claude-haiku-5-5"], 40);
});

test("clipName truncates long names with an ellipsis", () => {
  assert.equal(clipName("abcdef", 4), "abc…");
  assert.equal(clipName("abc", 8), "abc");
});

test("parseLimitsFromMarkdown reads the monthly-limit table", () => {
  const md = [
    "intro",
    "| Model | Monthly limit |",
    "| --- | --- |",
    "| MiniMax M2.7 | $100 |",
    "| Longcat 2.5 Preview Free | Unlimited |",
    "",
  ].join("\n");
  assert.deepEqual(parseLimitsFromMarkdown(md), {
    "minimax-m2.7": 100,
    "longcat-2.5-preview-free": UNLIMITED,
  });
});

test("parseUsageLimits picks HTML or markdown based on the body", () => {
  const html = "<table><tr><th>Model</th><th>Monthly limit</th></tr><tr><td>Qwen3.8 Max</td><td>$50</td></tr></table>";
  assert.deepEqual(parseUsageLimits(html), { "qwen3.8-max": 50 });
  assert.deepEqual(parseLimitsFromMarkdown("no table here"), {});
});

test("loadUsageLimits returns a fresh cached copy without fetching", async () => {
  let fetched = 0;
  const cache = {
    get: () => ({ at: 1000, limits: { cached: 5 } }),
    set: () => {},
  };
  const limits = await loadUsageLimits({
    cache,
    now: () => 1000 + 60_000,
    fetchImpl: async () => {
      fetched++;
      throw new Error("should not fetch");
    },
  });
  assert.deepEqual(limits, { cached: 5 });
  assert.equal(fetched, 0);
});

test("loadUsageLimits fetches, parses and caches when the cache is stale", async () => {
  const store = { value: undefined };
  const cache = { get: () => undefined, set: (_key, value) => (store.value = value) };
  const limits = await loadUsageLimits({
    cache,
    now: () => 5000,
    fetchImpl: async () => ({ ok: true, text: async () => "| Model | Monthly limit |\n| --- | --- |\n| A | $10 |" }),
  });
  assert.deepEqual(limits, { a: 10 });
  assert.deepEqual(store.value, { at: 5000, limits: { a: 10 } });
});

test("loadUsageLimits falls back to a stale cache when the network fails", async () => {
  const cache = { get: () => ({ at: 1000, limits: { stale: 3 } }), set: () => {} };
  const limits = await loadUsageLimits({
    cache,
    now: () => 1000 + 999_999_999,
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  assert.deepEqual(limits, { stale: 3 });
});

test("loadUsageLimits returns null when nothing is available", async () => {
  const limits = await loadUsageLimits({
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(limits, null);
});

test("buildCostItems maps V2 model data (cost array, time.released, providerID) and the active model", () => {
  const provider = { id: "opencode-go", name: "OpenCode Go" };
  const models = [
    { modelID: "minimax-m2.7", providerID: "opencode-go", name: "MiniMax M2.7", cost: [{ input: 1, output: 1 }], time: { released: "2025-01-01" } },
    { modelID: "qwen", providerID: "opencode-go", name: "Qwen", cost: [{ input: 2, output: 2 }], time: { released: "2025-01-01" } },
  ];
  const { items } = buildCostItems({
    providers: [provider],
    models,
    limits: { ...LIMITS, qwen: 50 },
    activeModel: { providerID: "opencode-go", modelID: "qwen" },
  });
  const qwen = items.find((i) => i.id === "qwen");
  const minimax = items.find((i) => i.id === "minimax-m2.7");
  assert.equal(qwen.active, true);
  assert.equal(minimax.active, false);
  assert.ok(Number.isFinite(qwen.burn));
});

test("normalizeModel reads both the V1 object cost and the V2 array cost", () => {
  const v1 = normalizeModel("m", { name: "M", cost: { input: 3, output: 1 }, release_date: "2025-01-01" });
  const v2 = normalizeModel("m", { name: "M", cost: [{ input: 3, output: 1 }], time: { released: 123 } });
  assert.deepEqual(v1.cost, { input: 3, output: 1 });
  assert.deepEqual(v2.cost, { input: 3, output: 1 });
  assert.equal(v2.released, 123);
});

test("isActiveModel matches by short id and by the V2 { modelID } shape", () => {
  assert.equal(isActiveModel("qwen", "opencode-go/qwen"), true);
  assert.equal(isActiveModel("qwen", { modelID: "qwen" }), true);
  assert.equal(isActiveModel("qwen", "other"), false);
  assert.equal(isActiveModel("qwen", null), false);
});

test("v1Theme resolves the V1 tokens into the neutral palette", () => {
  const theme = v1Theme({
    text: "#fff",
    textMuted: "#aaa",
    accent: "#accent",
    success: "#0f0",
    warning: "#ff0",
    error: "#f00",
  });
  assert.equal(theme.text, "#fff");
  assert.equal(theme.muted, "#aaa");
  assert.equal(theme.accent, "#accent");
  assert.equal(theme.success, "#0f0");
});

test("v2Theme resolves every token, including stateful accents", () => {
  const theme = v2Theme({
    text: {
      base: "#111",
      muted: "#222",
      faint: "#333",
      action: { primary: { base: "#abc", hover: "#def" } },
      feedback: { success: { base: "#0f0" }, warning: { base: "#ff0" }, error: { base: "#f00" } },
    },
  });
  assert.equal(theme.text, "#111");
  assert.equal(theme.muted, "#222");
  assert.equal(theme.faint, "#333");
  assert.equal(theme.dim, "#333");
  assert.equal(theme.accent, "#abc");
  assert.equal(theme.success, "#0f0");
  assert.equal(theme.warning, "#ff0");
  assert.equal(theme.error, "#f00");
});

test("v2Theme accepts a plain string accent", () => {
  const theme = v2Theme({ text: { base: "#111", action: { primary: "#xyz" } } });
  assert.equal(theme.accent, "#xyz");
});
