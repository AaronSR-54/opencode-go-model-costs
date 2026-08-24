/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { Show, createSignal, onCleanup } from "solid-js";

const SIDEBAR_ORDER = 200;
const RECENT_WINDOW_DAYS = 30;
const NAME_MAX_CHARS = 28;

function clipName(name: string, max: number): string {
  if (max < 4) max = 4;
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

// Monthly usage included with each model on the OpenCode Go plan ($).
// Source: https://opencode.ai/docs/go/ ("Usage" column). Models missing
// from this map have no known limit and fall back to raw cost ranking.
// Usage is metered as cost / limit, so a $15 model burns quota 4x faster
// than a $60 one at the same dollar price.
type UsageLimits = Record<string, number>;
const USAGE_LIMITS: UsageLimits = {
  "grok-4.5": 15,
  "gpt-5.6-luna": 15,
  "glm-5.3": 15,
  "glm-5.2": 60,
  "glm-5.1": 60,
  "kimi-k3": 15,
  "kimi-k2.7-code": 60,
  "kimi-k2.6": 60,
  "mimo-v2.5": 60,
  "mimo-v2.5-pro": 15,
  "minimax-m3": 60,
  "minimax-m2.7": 60,
  "minimax-m2.5": 60,
  "muse-spark-1.2-contributor": 60,
  "qwen3.8-max": 15,
  "qwen3.7-max": 60,
  "qwen3.7-plus": 60,
  "qwen3.6-plus": 60,
  "deepseek-v4-pro": 15,
  "deepseek-v4-flash": 30,
  "deepseek-v4-flash-vision-exp": 15,
  hy3: 60,
};

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

function getGoModels(api: TuiPluginApi): { items: CostItem[]; baseline: number } {
  const providers = api.state.provider as any[];
  const go = providers.find((p: any) =>
    p.id === "opencode-go" || p.id === "go" || RegExp("go", "i").test(p.name || "")
  );
  const models: Record<string, any> = go?.models ?? {};
  const entries = Object.entries(models) as [string, any][];

  // Quota burn rate: share of the model's own monthly usage allowance
  // consumed per blended 1M tokens. This is what actually depletes the
  // shared 5h/weekly/monthly windows.
  const baseLimit = USAGE_LIMITS[BASELINE_MODEL] ?? BASELINE_FALLBACK_LIMIT;
  const baseCost = models[BASELINE_MODEL]?.cost;
  const BASELINE_BURN =
    (baseCost ? baseCost.input + baseCost.output * 0.3 : BASELINE_FALLBACK_COST) / baseLimit;

  function limitOf(id: string): number | null {
    return USAGE_LIMITS[id.split("/").pop() || id] ?? null;
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

  const items: CostItem[] = entries.map(([id, m]) => {
    const c = m.cost;
    const recent = isRecent(m);
    if (!c) {
      return { id, name: m.name || id, mult: "?", score: null, burn: null, limit: null, recent };
    }
    const sc = c.input + c.output * 0.3;
    const limit = limitOf(id);
    if (limit && limit > 0) {
      const burn = sc / limit; // % of monthly allowance per 1M tok (fraction)
      return { id, name: m.name || id, score: sc, burn, limit, mult: fmtMult(burn / BASELINE_BURN), recent };
    }
    // Unknown usage limit: rank by raw price against the baseline cost.
    const rawMult = sc / (BASELINE_BURN * baseLimit);
    return { id, name: m.name || id, score: sc, burn: null, limit: null, mult: "~" + fmtMult(rawMult), recent };
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
              const costFg = m.score ? costColor(mx, props.api.theme.current) : props.api.theme.current.textMuted;
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

const tui = async (api: TuiPluginApi) => {
  const { items, baseline } = getGoModels(api);
  const [enabled, setEnabled] = createSignal(api.kv.get("costs-enabled", true) as boolean);

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
            <SidebarContentView api={api} items={items} baseline={baseline} sessionID={_props.session_id} />
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
