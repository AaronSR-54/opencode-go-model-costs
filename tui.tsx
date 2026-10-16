/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { Show, createMemo, createSignal, onCleanup } from "solid-js";
import type { TuiV2Context } from "./tui-v2-types";
import {
  NAME_MAX_CHARS,
  SIDEBAR_ORDER,
  buildCostItems,
  clipName,
  costColorKey,
  isGoProvider,
  kvCache,
  loadUsageLimits,
  v1Theme,
  v2Theme,
} from "./tui-core.js";

type UsageLimits = Record<string, number>;
type CostItem = {
  id: string;
  name: string;
  mult: string;
  score: number | null;
  burn: number | null;
  limit: number | null;
  recent: boolean;
  active: boolean;
};
type PanelTheme = {
  text: string;
  muted: string;
  faint: string;
  dim: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
};
type V2CostsStore = { enabled: boolean; collapsed: boolean };

function readStore<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

function CostsPanel(props: {
  items: CostItem[];
  baseline: number;
  collapsed: boolean;
  theme: () => PanelTheme;
  onToggleCollapse: () => void;
}) {
  const toggleIcon = () => (props.collapsed ? "▶" : "▼");

  return (
    <box gap={0}>
      <box flexDirection="row">
        <text fg={props.theme().text} onMouseDown={props.onToggleCollapse}>
          <b>{toggleIcon()} Costs</b>
        </text>
        <Show when={props.collapsed}>
          <text fg={props.theme().muted}> ({props.items.length} models)</text>
        </Show>
      </box>
      <Show when={!props.collapsed}>
        <box gap={0}>
          <box flexDirection="row" justifyContent="space-between">
            <text fg={props.theme().muted}>[OpenCode Go]</text>
            <text fg={props.theme().dim}>use/1M tok</text>
          </box>
          {props.items.map((m) => {
            const mx = m.burn !== null ? m.burn / props.baseline : 99;
            const active = m.active;
            const unknown = m.mult === "?";
            const costFg =
              unknown || !m.score
                ? props.theme().muted
                : props.theme()[costColorKey(mx) as "success" | "warning" | "error"];
            const nameFg = active ? props.theme().accent : props.theme().muted;
            const tag = m.recent ? "✦ " : "";
            const label = clipName(m.name, NAME_MAX_CHARS - tag.length);
            return (
              <box flexDirection="row" justifyContent="space-between">
                <text fg={active ? props.theme().accent : costFg} wrapMode="none">
                  {active ? "● " : "  "}
                  {m.mult}
                </text>
                <box flexDirection="row">
                  <text fg={props.theme().faint} wrapMode="none">
                    {tag}
                  </text>
                  <text fg={nameFg} wrapMode="none">
                    {label}
                  </text>
                </box>
              </box>
            );
          })}
        </box>
      </Show>
    </box>
  );
}

function LimitsUnavailable(props: { theme: () => PanelTheme }) {
  return (
    <box gap={0}>
      <text fg={props.theme().text}>
        <b>▼ Costs</b>
      </text>
      <text fg={props.theme().muted}>[OpenCode Go] limits unavailable</text>
    </box>
  );
}

function V1SidebarContent(props: { api: TuiPluginApi; limits: UsageLimits; sessionID: string }) {
  const [activeId, setActiveId] = createSignal("");
  const [collapsed, setCollapsed] = createSignal(props.api.kv.get("costs-collapsed", false) as boolean);

  const dispose = props.api.event.on("session.updated" as any, (event: any) => {
    const sid = event.properties?.info?.id;
    if (sid && sid !== props.sessionID) return;
    const id = event.properties?.info?.model?.id;
    if (id) setActiveId(id);
  });
  onCleanup(dispose);

  const data = createMemo(() =>
    buildCostItems({
      providers: props.api.state.provider as any[],
      limits: props.limits,
      activeModel: activeId(),
    })
  );

  const theme = () => v1Theme(props.api.theme.current);

  const toggleCollapsed = () => {
    const next = !collapsed();
    setCollapsed(next);
    props.api.kv.set("costs-collapsed", next);
  };

  return (
    <Show when={data().items.length > 0}>
      <CostsPanel
        items={data().items}
        baseline={data().baseline}
        collapsed={collapsed()}
        theme={theme}
        onToggleCollapse={toggleCollapsed}
      />
    </Show>
  );
}

function V2SidebarContent(props: {
  context: TuiV2Context;
  limits: UsageLimits;
  store: () => V2CostsStore;
  update: (mutator: (draft: V2CostsStore) => void) => unknown;
  sessionID: string;
}) {
  const theme = () => v2Theme(props.context.theme);
  const collapsed = () => props.store().collapsed;

  const data = createMemo(() => {
    const context = props.context;
    const location = context.location ?? context.data.location.default();
    const providers = context.data.location.provider.list(location) ?? [];
    const go = providers.find((p) => isGoProvider(p.id, p.name));
    const models = (context.data.location.model.list(location) ?? []).filter(
      (m) => !!go && m.providerID === go.id
    );
    return buildCostItems({
      providers,
      models: go ? models : [],
      limits: props.limits,
      activeModel: context.ui.model.current(),
    });
  });

  const toggleCollapsed = () => {
    props.update((draft) => {
      draft.collapsed = !draft.collapsed;
    });
  };

  return (
    <Show when={data().items.length > 0}>
      <CostsPanel
        items={data().items}
        baseline={data().baseline}
        collapsed={collapsed()}
        theme={theme}
        onToggleCollapse={toggleCollapsed}
      />
    </Show>
  );
}

const tui = async (api: TuiPluginApi) => {
  const [enabled, setEnabled] = createSignal(api.kv.get("costs-enabled", true) as boolean);
  const [usageLimits, setUsageLimits] = createSignal<UsageLimits | null | undefined>(undefined);
  loadUsageLimits({ cache: kvCache(api.kv) })
    .then((limits) => setUsageLimits(limits))
    .catch(() => setUsageLimits(null));

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
      sidebar_content(_ctx: any, props: { session_id: string }) {
        return (
          <Show when={enabled()}>
            <Show
              when={usageLimits()}
              fallback={
                <Show when={usageLimits() === null}>
                  <LimitsUnavailable theme={() => v1Theme(api.theme.current)} />
                </Show>
              }
            >
              <V1SidebarContent api={api} limits={usageLimits()!} sessionID={props.session_id} />
            </Show>
          </Show>
        );
      },
    },
  });
};

const setup = async (context: TuiV2Context) => {
  const [storeValue, update] = context.storage.store("costs", {
    initial: { enabled: true, collapsed: false } as V2CostsStore,
  });
  const store = () => readStore(storeValue);

  const [usageLimits, setUsageLimits] = createSignal<UsageLimits | null | undefined>(undefined);
  loadUsageLimits()
    .then((limits) => setUsageLimits(limits))
    .catch(() => setUsageLimits(null));

  const disposeSlot = context.ui.slot({
    append: "sidebar.content",
    render: ({ sessionID }) => (
      <Show when={store().enabled}>
        <Show
          when={usageLimits()}
          fallback={
            <Show when={usageLimits() === null}>
              <LimitsUnavailable theme={() => v2Theme(context.theme)} />
            </Show>
          }
        >
          <V2SidebarContent
            context={context}
            limits={usageLimits()!}
            store={store}
            update={update}
            sessionID={sessionID}
          />
        </Show>
      </Show>
    ),
  });

  context.keymap.layer(() => ({
    mode: "global",
    commands: [
      {
        id: "model-costs.toggle",
        title: "Toggle Go Costs",
        group: "Model Costs",
        slash: { name: "toggle-costs" },
        run: () => {
          update((draft) => {
            draft.enabled = !draft.enabled;
          });
        },
      },
    ],
  }));

  return () => {
    if (typeof disposeSlot === "function") disposeSlot();
  };
};

const pluginModule: TuiPluginModule & {
  id: string;
  setup: (context: TuiV2Context) => Promise<() => void>;
} = {
  id: "model-costs",
  tui,
  setup,
};

export default pluginModule;
