// Pure, runtime-free core shared by the V1 and V2 TUI adapters. It contains no
// JSX and touches no plugin runtime API, so it can be unit-tested directly.

export const SIDEBAR_ORDER = 200;
export const RECENT_WINDOW_DAYS = 30;
export const NAME_MAX_CHARS = 28;

// Monthly usage limits are looked up at runtime from the official Go docs
// instead of a hardcoded table, so models added/removed/changed upstream are
// picked up automatically. Sources are tried in order: the legacy markdown
// endpoint first, then the current docs page (HTML). Each contains the
// per-model "Monthly limit" table.
// The docs' base "Go" table is used: Go Plus scales every limit by the same
// factor, so relative burn rates are identical.
export const USAGE_LIMITS_URLS = [
  "https://opencode.ai/docs/go.md",
  "https://opencode.ai/v2/docs/console/go/",
  "https://opencode.ai/docs/go/",
];
export const USAGE_LIMITS_CACHE_KEY = "costs-usage-limits";
export const USAGE_LIMITS_TTL_MS = 12 * 60 * 60 * 1000;
// Free/unlimited models consume no quota. Kept JSON-safe for the kv cache.
export const UNLIMITED = Number.MAX_SAFE_INTEGER;

export const BASELINE_MODEL = "minimax-m2.7";
export const BASELINE_FALLBACK_COST = 0.66;
export const BASELINE_FALLBACK_LIMIT = 60;

export function clipName(name, max) {
  if (max < 4) max = 4;
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

// "DeepSeek V4.1 Flash (Off-Peak)" -> "deepseek-v4.1-flash", which matches
// the provider's model id. Tier / price suffixes are dropped.
export function normalizeModelId(name) {
  return name
    .replace(/\([^)]*\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Docs names and provider model ids don't always agree on separators: the docs
// write "Claude Haiku 5.5" (-> claude-haiku-5.5) while the catalog id is
// "claude-haiku-5-5". Collapse dots/dashes so both sides match.
export function matchKey(name) {
  return normalizeModelId(name).replace(/\./g, "-");
}

// Index limits by separator-insensitive key so ids like claude-haiku-5-5 find
// the docs' claude-haiku-5.5 entry (and vice versa).
export function buildLimitIndex(limits) {
  const index = {};
  for (const [key, value] of Object.entries(limits)) index[matchKey(key)] = value;
  return index;
}

export function firstNumber(raw) {
  const match = raw.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)/) ?? raw.match(/([0-9][0-9,]*(?:\.[0-9]+)?)/);
  return match ? parseFloat(match[1].replace(/,/g, "")) : null;
}

// Parse the first "Monthly limit" markdown table from the docs source.
export function parseLimitsFromMarkdown(markdown) {
  const limits = {};
  const lines = markdown.split(/\r?\n/);
  let i = lines.findIndex((l) => /^\s*\|.*Monthly limit/i.test(l));
  if (i < 0) return limits;
  i += 2; // skip the header + separator rows
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s*\|/.test(line)) break;
    const cells = line.split("|").slice(1, -1).map((s) => s.trim());
    if (cells.length < 2) continue;
    const raw = cells[cells.length - 1];
    const key = normalizeModelId(cells[0]);
    if (!key) continue;
    if (/unlimited/i.test(raw)) {
      limits[key] = UNLIMITED;
      continue;
    }
    const value = firstNumber(raw);
    if (value !== null) limits[key] = value;
  }
  return limits;
}

export function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Parse the per-model "Monthly limit" table rendered on the docs page. Struck
// through old prices (<del>) are dropped so the current value wins.
export function parseLimitsFromHtml(html) {
  const limits = {};
  const tables = html.match(/<table[\s\S]*?<\/table>/gi);
  const table = tables?.find((t) => /Monthly limit/i.test(t));
  if (!table) return limits;
  const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cellHtml = row.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? [];
    const cells = cellHtml.map((c) => stripHtml(c.replace(/<del[\s\S]*?<\/del>/gi, "")));
    if (cells.length < 2) continue;
    if (/^model$/i.test(cells[0])) continue;
    const key = normalizeModelId(cells[0]);
    if (!key) continue;
    const raw = cells[cells.length - 1];
    if (/unlimited/i.test(raw)) {
      limits[key] = UNLIMITED;
      continue;
    }
    const value = firstNumber(raw);
    if (value !== null) limits[key] = value;
  }
  return limits;
}

export function parseUsageLimits(body) {
  return /<table/i.test(body) ? parseLimitsFromHtml(body) : parseLimitsFromMarkdown(body);
}

// Fetch limits from the docs, falling back to a cached copy (even stale) when
// the network is unavailable. Returns null only when nothing is available.
// The cache and the fetch implementation are injectable so the V1/V2 adapters
// can wire their own storage, and tests can run without the network.
export async function loadUsageLimits({
  cache,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  urls = USAGE_LIMITS_URLS,
  ttlMs = USAGE_LIMITS_TTL_MS,
  timeoutMs = 10000,
} = {}) {
  const get = typeof cache?.get === "function" ? (key) => cache.get(key) : () => undefined;
  const set = typeof cache?.set === "function" ? (key, value) => cache.set(key, value) : () => {};
  const cached = get(USAGE_LIMITS_CACHE_KEY);
  const hasCache = !!cached?.limits && Object.keys(cached.limits).length > 0;
  if (hasCache && now() - cached.at < ttlMs) return cached.limits;
  for (const url of urls) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) continue;
      const limits = parseUsageLimits(await res.text());
      if (Object.keys(limits).length === 0) continue;
      set(USAGE_LIMITS_CACHE_KEY, { at: now(), limits });
      return limits;
    } catch {
      // try the next source
    }
  }
  return hasCache ? cached.limits : null;
}

// Adapter for the V1 key-value store so it satisfies the injectable cache API.
export function kvCache(kv) {
  return {
    get: (key) => kv.get(key, null),
    set: (key, value) => kv.set(key, value),
  };
}

export function costColorKey(n) {
  if (n <= 1.5) return "success";
  if (n <= 5) return "warning";
  return "error";
}

export function isGoProvider(id, name) {
  return id === "opencode-go" || id === "go" || /go/i.test(name || "");
}

function activeModelId(activeModel) {
  if (!activeModel) return "";
  if (typeof activeModel === "string") return activeModel;
  return activeModel.modelID || activeModel.id || "";
}

export function isActiveModel(id, activeModel) {
  const a = activeModelId(activeModel);
  if (!a) return false;
  if (a === id) return true;
  const aShort = a.split("/").pop() || "";
  const idShort = id.split("/").pop() || "";
  return aShort === idShort || a.endsWith("/" + id) || a.includes(id);
}

// Both runtimes describe a model with different field names: V1 uses
// `release_date` and an object `cost`, V2 uses `time.released` and an array
// `cost`. Normalize to a single shape for the shared computation.
export function normalizeModel(id, model) {
  const cost = Array.isArray(model.cost) ? model.cost[0] : model.cost;
  const released = model.time?.released ?? model.release_date ?? null;
  return {
    id: String(model.id ?? model.modelID ?? id),
    name: model.name ?? model.id ?? id,
    cost: cost && typeof cost.input === "number" ? { input: cost.input, output: cost.output ?? 0 } : null,
    released,
  };
}

function selectModelEntries({ providers, models }) {
  if (models) {
    return Array.isArray(models) ? models.map((m) => [m.id ?? m.modelID, m]) : Object.entries(models);
  }
  const list = Array.isArray(providers) ? providers : [];
  const go = list.find((p) => isGoProvider(p.id, p.name));
  return Object.entries(go?.models ?? {});
}

// Quota burn rate: share of the model's own monthly usage allowance consumed
// per blended 1M tokens. This is what actually depletes the shared
// 5h/weekly/monthly windows.
export function buildCostItems({ providers, models, limits, activeModel = null } = {}) {
  const entries = selectModelEntries({ providers, models });
  const normalized = entries.map(([id, m]) => normalizeModel(id, m));

  const byId = Object.create(null);
  for (const m of normalized) byId[m.id] = m;
  const baseModel =
    byId[BASELINE_MODEL] ??
    normalized.find((m) => matchKey(m.id.split("/").pop() || m.id) === matchKey(BASELINE_MODEL));

  const limitIndex = buildLimitIndex(limits || {});
  const baseLimit = limitIndex[matchKey(BASELINE_MODEL)] ?? BASELINE_FALLBACK_LIMIT;
  const baseCost = baseModel?.cost;
  const BASELINE_BURN =
    (baseCost ? baseCost.input + baseCost.output * 0.3 : BASELINE_FALLBACK_COST) / baseLimit;

  function limitOf(id) {
    return limitIndex[matchKey(id.split("/").pop() || id)] ?? null;
  }

  const dates = [];
  for (const m of normalized) {
    const d = Date.parse(m.released);
    if (!isNaN(d)) dates.push(d);
  }
  const newest = dates.length > 0 ? Math.max(...dates) : Date.now();
  const threshold = newest - RECENT_WINDOW_DAYS * 86400000;

  function isRecent(m) {
    const d = Date.parse(m.released);
    return !isNaN(d) && d >= threshold;
  }

  const fmtMult = (n) => (n >= 10 ? Math.round(n) + "x" : n.toFixed(1) + "x");

  // Models missing a price or a documented usage limit are shown with a "?"
  // marker instead of an approximate multiplier.
  const items = normalized
    .map((m) => {
      const recent = isRecent(m);
      const active = isActiveModel(m.id, activeModel);
      const c = m.cost;
      const limit = limitOf(m.id);
      if (!c || !limit || limit <= 0) {
        const score = c ? c.input + c.output * 0.3 : null;
        return { id: m.id, name: m.name, mult: "?", score, burn: null, limit: null, recent, active };
      }
      const sc = c.input + c.output * 0.3;
      const burn = sc / limit; // share of monthly allowance per 1M tok
      return {
        id: m.id,
        name: m.name,
        score: sc,
        burn,
        limit,
        mult: fmtMult(burn / BASELINE_BURN),
        recent,
        active,
      };
    })
    .sort((a, b) => {
      const ka = a.burn ?? a.score ?? Infinity;
      const kb = b.burn ?? b.score ?? Infinity;
      return ka - kb;
    });

  return { items, baseline: BASELINE_BURN };
}

// Resolve the V1 theme snapshot into the neutral token set the panel uses.
// V1 hands over concrete `RGBA` values, so this stays a pass-through; routing
// through `resolveColor` keeps a single color path and also accepts string
// palettes.
export function v1Theme(current) {
  const c = current || {};
  return {
    text: resolveColor(c.text),
    muted: resolveColor(c.textMuted),
    faint: "#666666",
    dim: "#555555",
    accent: resolveColor(c.accent),
    success: resolveColor(c.success),
    warning: resolveColor(c.warning),
    error: resolveColor(c.error),
  };
}

// Colors reach the plugin in three shapes: CSS-like strings (V1 themes and
// custom V2 themes), OpenTUI `RGBA` instances (V2 resolved tokens, accepted
// directly by `fg`), and stateful tokens (`{ base, hovered, focused, ... }`).
// `resolveColor` normalizes all of them to a usable ColorInput, or "" when
// nothing usable is found (OpenTUI then falls back to the terminal default).
function isRgba(value) {
  if (typeof value.toInts === "function") return true;
  const buffer = value.buffer;
  return ArrayBuffer.isView(buffer) && typeof buffer[0] === "number";
}

export function resolveColor(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  if (isRgba(value)) return value;
  // Stateful tokens expose their default color as `base`.
  if (Object.prototype.hasOwnProperty.call(value, "base")) {
    const base = resolveColor(value.base);
    if (base) return base;
  }
  // Be lenient with unexpected shapes: use the first nested color we can find.
  for (const key of Object.keys(value)) {
    const resolved = resolveColor(value[key]);
    if (resolved) return resolved;
  }
  return "";
}

// Resolve the V2 theme tokens (text.base/muted/faint, action.primary, and
// feedback.*) into the same neutral token set. V2 feeds `RGBA` instances and
// stateful wrappers, so everything goes through `resolveColor`.
export function v2Theme(theme) {
  const text = theme?.text ?? {};
  const feedback = text.feedback ?? {};
  return {
    text: resolveColor(text.base),
    muted: resolveColor(text.muted),
    faint: resolveColor(text.faint),
    dim: resolveColor(text.faint),
    accent: resolveColor(text.action?.primary) || resolveColor(text.base),
    success: resolveColor(feedback.success),
    warning: resolveColor(feedback.warning),
    error: resolveColor(feedback.error),
  };
}
