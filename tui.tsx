/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { Show, createSignal, onCleanup } from "solid-js";

const SIDEBAR_ORDER = 200;
const RECENT_WINDOW_DAYS = 30;

type CostItem = { id: string; name: string; mult: string; score: number | null; recent: boolean };

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

  const baseCost = models["minimax-m2.7"]?.cost;
  const BASELINE = baseCost ? baseCost.input + baseCost.output * 0.3 : 0.66;

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

  const items: CostItem[] = entries.map(([id, m]) => {
    const c = m.cost;
    const recent = isRecent(m);
    if (!c) return { id, name: m.name || id, mult: "?", score: null, recent };
    const sc = c.input + c.output * 0.3;
    const n = sc / BASELINE;
    return { id, name: m.name || id, score: sc, mult: n >= 10 ? Math.round(n) + "x" : n.toFixed(1) + "x", recent };
  }).sort((a, b) => {
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return a.score - b.score;
  });

  return { items, baseline: BASELINE };
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
              <text fg="#555555">$/1M tok</text>
            </box>
            {props.items.map((m) => {
              const mx = m.score ? m.score / props.baseline : 99;
              const active = isActive(m.id);
              const costFg = m.score ? costColor(mx, props.api.theme.current) : props.api.theme.current.textMuted;
              const nameFg = active ? props.api.theme.current.accent : props.api.theme.current.textMuted;
              return (
                <box flexDirection="row" justifyContent="space-between">
                  <text fg={active ? props.api.theme.current.accent : costFg} wrapMode="none">{active ? "● " : "  "}{m.mult}</text>
                  <box flexDirection="row">
                    <text fg="#666666" wrapMode="none">{m.recent ? "(recent) " : ""}</text>
                    <text fg={nameFg} wrapMode="none">{m.name}</text>
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

  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content(_ctx: any, _props: { session_id: string }) {
        return (
          <SidebarContentView api={api} items={items} baseline={baseline} sessionID={_props.session_id} />
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
