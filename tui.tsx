/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { Show, createMemo, createSignal, onCleanup } from "solid-js";

const SIDEBAR_ORDER = 200;
const RECENT_WINDOW_DAYS = 30;
const NAME_MAX_CHARS = 28;

function clipName(name: string, max: number): string {
  if (max < 4) max = 4;
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

// Monthly usage limits are looked up at runtime from the official Go docs
// instead of a hardcoded table, so models added/removed upstream are picked
// up automatically. https://opencode.ai/docs/go.md serves the docs source
// markdown containing the per-model "Monthly limit" table.
// The docs' base "Go" table is used: Go Plus scales every limit by the same
// factor, so relative burn rates are identical.
const USAGE_LIMITS_URL = "https://opencode.ai/docs/go.md";
const USAGE_LIMITS_CACHE_KEY = "costs-usage-limits";
const USAGE_LIMITS_TTL_MS = 12 * 60 * 60 * 1000;
// Free/unlimited models consume no quota. Kept JSON-safe for the kv cache.
const UNLIMITED = Number.MAX_SAFE_INTEGER;

type UsageLimits = Record<string, number>;

// "DeepSeek V4.1 Flash (Off-Peak)" -> "deepseek-v4.1-flash", which matches
// the provider's model id. Tier / price suffixes are dropped.
function normalizeModelId(name: string): string {
  return name
    .replace(/\([^)]*\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Parse the first "Monthly limit" markdown table from the docs source.
function parseUsageLimits(markdown: string): UsageLimits {
  const limits: UsageLimits = {};
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
    const match = raw.match(/[0-9]+(?:\.[0-9]+)?/);
    if (match) limits[key] = parseFloat(match[0]);
  }
  return limits;
}

// Fetch limits from the docs, falling back to a cached copy (even stale) when
// the network is unavailable. Returns null only when nothing is available.
async function loadUsageLimits(api: TuiPluginApi): Promise<UsageLimits | null> {
  const cached = api.kv.get<{ at: number; limits: UsageLimits } | null>(USAGE_LIMITS_CACHE_KEY, null);
  const hasCache = !!cached?.limits && Object.keys(cached.limits).length > 0;
  if (hasCache && Date.now() - cached!.at < USAGE_LIMITS_TTL_MS) return cached!.limits;
  try {
    const res = await fetch(USAGE_LIMITS_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const limits = parseUsageLimits(await res.text());
    if (Object.keys(limits).length === 0) throw new Error("empty usage table");
    api.kv.set(USAGE_LIMITS_CACHE_KEY, { at: Date.now(), limits });
    return limits;
  } catch {
    return hasCache ? cached!.limits : null;
  }
}

const BASELINE_MODEL = "minimax-m2.7";
const BASELINE_FALLBACK_COST = 0.66;
const BASELINE_FALLBACK_LIMIT = 60;

type CostItem = {
  id: string;
  name: string;
  mult: string;
  score: number | null;
  burn: number | null;
  limit: number | null;
  recent: boolean;
};

function costColor(n: number, theme: TuiPluginApi["theme"]["current"]) {
  if (n <= 1.5) return theme.success;
  if (n <= 5) return theme.warning;
  return theme.error;
}

function getGoModels(api: TuiPluginApi, limits: UsageLimits): { items: CostItem[]; baseline: number } {
  const providers = api.state.provider as any[];
  const go = providers.find((p: any) =>
    p.id === "opencode-go" || p.id === "go" || RegExp("go", "i").test(p.name || "")
  );
  const models: Record<string, any> = go?.models ?? {};
  const entries = Object.entries(models) as [string, any][];

  // Quota burn rate: share of the model's own monthly usage allowance
  // consumed per blended 1M tokens. This is what actually depletes the
  // shared 5h/weekly/monthly windows.
  const baseLimit = limits[BASELINE_MODEL] ?? BASELINE_FALLBACK_LIMIT;
  const baseCost = models[BASELINE_MODEL]?.cost;
  const BASELINE_BURN =
    (baseCost ? baseCost.input + baseCost.output * 0.3 : BASELINE_FALLBACK_COST) / baseLimit;

  function limitOf(id: string): number | null {
    return limits[normalizeModelId(id.split("/").pop() || id)] ?? null;
  }

  const dates: number[] = [];
  for (const [, m] of entries) {
    const d = Date.parse(m.release_date);
    if (!isNaN(d)) dates.push(d);
  }
  const newest = dates.length > 0 ? Math.max(...dates) : Date.now();
  const threshold = newest - RECENT_WINDOW_DAYS * 86400000;

  function isRecent(m: any): boolean {
    const d = Date.parse(m.release_date);
    return !isNaN(d) && d >= threshold;
  }

  const fmtMult = (n: number) => (n >= 10 ? Math.round(n) + "x" : n.toFixed(1) + "x");

  // Models missing a price or a documented usage limit are shown with a "?"
  // marker instead of an approximate multiplier.
  const items: CostItem[] = entries.map(([id, m]) => {
    const recent = isRecent(m);
    const c = m.cost;
    const limit = limitOf(id);
    if (!c || !limit || limit <= 0) {
      const score = c ? c.input + c.output * 0.3 : null;
      return { id, name: m.name || id, mult: "?", score, burn: null, limit: null, recent };
    }
    const sc = c.input + c.output * 0.3;
    const burn = sc / limit; // share of monthly allowance per 1M tok
    return { id, name: m.name || id, score: sc, burn, limit, mult: fmtMult(burn / BASELINE_BURN), recent };
  }).sort((a, b) => {
    const ka = a.burn ?? a.score ?? Infinity;
    const kb = b.burn ?? b.score ?? Infinity;
    return ka - kb;
  });

  return { items, baseline: BASELINE_BURN };
}

function SidebarContentView(props: { api: TuiPluginApi; items: CostItem[]; baseline: number; sessionID: string }) {
  const [activeId, setActiveId] = createSignal<string>("");
  const [collapsed, setCollapsed] = createSignal(props.api.kv.get("costs-collapsed", false) as boolean);

  const dispose = props.api.event.on("session.updated" as any, (event: any) => {
    const sid = event.properties?.info?.id;
    if (sid && sid !== props.sessionID) return;
    const id = event.properties?.info?.model?.id;
    if (id) setActiveId(id);
  });
  onCleanup(dispose);

  const isActive = (id: string) => {
    const a = activeId();
    if (!a) return false;
    if (a === id) return true;
    const aShort = a.split("/").pop() || "";
    const idShort = id.split("/").pop() || "";
    return aShort === idShort || a.endsWith("/" + id) || a.includes(id);
  };

  const toggleCollapsed = () => {
    const next = !collapsed();
    setCollapsed(next);
    props.api.kv.set("costs-collapsed", next);
  };

  const toggleIcon = () => collapsed() ? "▶" : "▼";

  return (
    <Show when={props.items.length > 0}>
      <box gap={0}>
        <box flexDirection="row">
          <text fg={props.api.theme.current.text} onMouseDown={toggleCollapsed}>
            <b>{toggleIcon()} Costs</b>
          </text>
          <Show when={collapsed()}>
            <text fg={props.api.theme.current.textMuted}> ({props.items.length} models)</text>
          </Show>
        </box>
        <Show when={!collapsed()}>
          <box gap={0}>
            <box flexDirection="row" justifyContent="space-between">
              <text fg={props.api.theme.current.textMuted}>[OpenCode Go]</text>
              <text fg="#555555">use/1M tok</text>
            </box>
            {props.items.map((m) => {
              const mx = m.burn !== null ? m.burn / props.baseline : 99;
              const active = isActive(m.id);
              const unknown = m.mult === "?";
              const costFg = unknown || !m.score ? props.api.theme.current.textMuted : costColor(mx, props.api.theme.current);
              const nameFg = active ? props.api.theme.current.accent : props.api.theme.current.textMuted;
              const tag = m.recent ? "✦ " : "";
              const label = clipName(m.name, NAME_MAX_CHARS - tag.length);
              return (
                <box flexDirection="row" justifyContent="space-between">
                  <text fg={active ? props.api.theme.current.accent : costFg} wrapMode="none">{active ? "● " : "  "}{m.mult}</text>
                  <box flexDirection="row">
                    <text fg="#666666" wrapMode="none">{tag}</text>
                    <text fg={nameFg} wrapMode="none">{label}</text>
                  </box>
                </box>
              );
            })}
          </box>
        </Show>
      </box>
    </Show>
  );
}

function LimitsUnavailable(props: { api: TuiPluginApi }) {
  return (
    <box gap={0}>
      <text fg={props.api.theme.current.text}>
        <b>▼ Costs</b>
      </text>
      <text fg={props.api.theme.current.textMuted}>[OpenCode Go] limits unavailable</text>
    </box>
  );
}

const tui = async (api: TuiPluginApi) => {
  const [enabled, setEnabled] = createSignal(api.kv.get("costs-enabled", true) as boolean);
  const [usageLimits, setUsageLimits] = createSignal<UsageLimits | null | undefined>(undefined);
  loadUsageLimits(api)
    .then((limits) => setUsageLimits(limits))
    .catch(() => setUsageLimits(null));
  const data = createMemo(() => {
    const limits = usageLimits();
    return limits ? getGoModels(api, limits) : null;
  });

  const toggle = () => {
    const next = !enabled();
    setEnabled(next);
    api.kv.set("costs-enabled", next);
  };

  if (api.command) {
    const disposeCommand = api.command.register(() => [
      {
        title: "Toggle Go Costs",
        value: "model-costs.toggle",
        description: "Show/hide the Go model costs sidebar",
        category: "Model Costs",
        slash: { name: "toggle-costs" },
        onSelect: toggle,
      },
    ]);
    api.lifecycle.onDispose(() => disposeCommand());
  }

  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content(_ctx: any, _props: { session_id: string }) {
        return (
          <Show when={enabled()}>
            <Show
              when={data()}
              fallback={
                <Show when={usageLimits() === null}>
                  <LimitsUnavailable api={api} />
                </Show>
              }
            >
              {(d) => (
                <SidebarContentView
                  api={api}
                  items={d().items}
                  baseline={d().baseline}
                  sessionID={_props.session_id}
                />
              )}
            </Show>
          </Show>
        );
      },
    },
  });
};

const pluginModule: TuiPluginModule & { id: string } = {
  id: "model-costs",
  tui,
};

export default pluginModule;
