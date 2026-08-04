import { memo as _$memo } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
/** @jsxImportSource @opentui/solid */

import { Show, createSignal, onCleanup } from "solid-js";
const SIDEBAR_ORDER = 200;
const RECENT_WINDOW_DAYS = 30;
function costColor(n, theme) {
  if (n <= 1.5) return theme.success;
  if (n <= 5) return theme.warning;
  return theme.error;
}
function getGoModels(api) {
  const providers = api.state.provider;
  const go = providers.find(p => p.id === "opencode-go" || p.id === "go" || RegExp("go", "i").test(p.name || ""));
  const models = go?.models ?? {};
  const entries = Object.entries(models);
  const baseCost = models["minimax-m2.7"]?.cost;
  const BASELINE = baseCost ? baseCost.input + baseCost.output * 0.3 : 0.66;
  const dates = [];
  for (const [, m] of entries) {
    const d = Date.parse(m.release_date);
    if (!isNaN(d)) dates.push(d);
  }
  const newest = dates.length > 0 ? Math.max(...dates) : Date.now();
  const threshold = newest - RECENT_WINDOW_DAYS * 86400000;
  function isRecent(m) {
    const d = Date.parse(m.release_date);
    return !isNaN(d) && d >= threshold;
  }
  const items = entries.map(([id, m]) => {
    const c = m.cost;
    const recent = isRecent(m);
    if (!c) return {
      id,
      name: m.name || id,
      mult: "?",
      score: null,
      recent
    };
    const sc = c.input + c.output * 0.3;
    const n = sc / BASELINE;
    return {
      id,
      name: m.name || id,
      score: sc,
      mult: n >= 10 ? Math.round(n) + "x" : n.toFixed(1) + "x",
      recent
    };
  }).sort((a, b) => {
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return a.score - b.score;
  });
  return {
    items,
    baseline: BASELINE
  };
}
function SidebarContentView(props) {
  const [activeId, setActiveId] = createSignal("");
  const [collapsed, setCollapsed] = createSignal(props.api.kv.get("costs-collapsed", false));
  const dispose = props.api.event.on("session.updated", event => {
    const sid = event.properties?.info?.id;
    if (sid && sid !== props.sessionID) return;
    const id = event.properties?.info?.model?.id;
    if (id) setActiveId(id);
  });
  onCleanup(dispose);
  const isActive = id => {
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
  return _$createComponent(Show, {
    get when() {
      return props.items.length > 0;
    },
    get children() {
      var _el$ = _$createElement("box"),
        _el$2 = _$createElement("box"),
        _el$3 = _$createElement("text"),
        _el$4 = _$createElement("b"),
        _el$5 = _$createTextNode(` Costs`);
      _$insertNode(_el$, _el$2);
      _$setProp(_el$, "gap", 0);
      _$insertNode(_el$2, _el$3);
      _$setProp(_el$2, "flexDirection", "row");
      _$insertNode(_el$3, _el$4);
      _$setProp(_el$3, "onMouseDown", toggleCollapsed);
      _$insertNode(_el$4, _el$5);
      _$insert(_el$4, toggleIcon, _el$5);
      _$insert(_el$2, _$createComponent(Show, {
        get when() {
          return collapsed();
        },
        get children() {
          var _el$6 = _$createElement("text"),
            _el$7 = _$createTextNode(` (`),
            _el$8 = _$createTextNode(` models)`);
          _$insertNode(_el$6, _el$7);
          _$insertNode(_el$6, _el$8);
          _$insert(_el$6, () => props.items.length, _el$8);
          _$effect(_$p => _$setProp(_el$6, "fg", props.api.theme.current.textMuted, _$p));
          return _el$6;
        }
      }), null);
      _$insert(_el$, _$createComponent(Show, {
        get when() {
          return !collapsed();
        },
        get children() {
          var _el$9 = _$createElement("box"),
            _el$0 = _$createElement("box"),
            _el$1 = _$createElement("text"),
            _el$11 = _$createElement("text");
          _$insertNode(_el$9, _el$0);
          _$setProp(_el$9, "gap", 0);
          _$insertNode(_el$0, _el$1);
          _$insertNode(_el$0, _el$11);
          _$setProp(_el$0, "flexDirection", "row");
          _$setProp(_el$0, "justifyContent", "space-between");
          _$insertNode(_el$1, _$createTextNode(`[OpenCode Go]`));
          _$insertNode(_el$11, _$createTextNode(`$/1M tok`));
          _$setProp(_el$11, "fg", "#555555");
          _$insert(_el$9, () => props.items.map(m => {
            const mx = m.score ? m.score / props.baseline : 99;
            const active = isActive(m.id);
            const costFg = m.score ? costColor(mx, props.api.theme.current) : props.api.theme.current.textMuted;
            const nameFg = active ? props.api.theme.current.accent : props.api.theme.current.textMuted;
            return (() => {
              var _el$13 = _$createElement("box"),
                _el$14 = _$createElement("text"),
                _el$15 = _$createElement("box"),
                _el$16 = _$createElement("text"),
                _el$17 = _$createElement("text");
              _$insertNode(_el$13, _el$14);
              _$insertNode(_el$13, _el$15);
              _$setProp(_el$13, "flexDirection", "row");
              _$setProp(_el$13, "justifyContent", "space-between");
              _$setProp(_el$14, "wrapMode", "none");
              _$insert(_el$14, active ? "● " : "  ", null);
              _$insert(_el$14, () => m.mult, null);
              _$insertNode(_el$15, _el$16);
              _$insertNode(_el$15, _el$17);
              _$setProp(_el$15, "flexDirection", "row");
              _$setProp(_el$16, "fg", "#666666");
              _$setProp(_el$16, "wrapMode", "none");
              _$insert(_el$16, () => m.recent ? "(recent) " : "");
              _$setProp(_el$17, "fg", nameFg);
              _$setProp(_el$17, "wrapMode", "none");
              _$insert(_el$17, () => m.name);
              _$effect(_$p => _$setProp(_el$14, "fg", active ? props.api.theme.current.accent : costFg, _$p));
              return _el$13;
            })();
          }), null);
          _$effect(_$p => _$setProp(_el$1, "fg", props.api.theme.current.textMuted, _$p));
          return _el$9;
        }
      }), null);
      _$effect(_$p => _$setProp(_el$3, "fg", props.api.theme.current.text, _$p));
      return _el$;
    }
  });
}
const tui = async api => {
  const {
    items,
    baseline
  } = getGoModels(api);
  const [enabled, setEnabled] = createSignal(api.kv.get("costs-enabled", true));
  const toggle = () => {
    const next = !enabled();
    setEnabled(next);
    api.kv.set("costs-enabled", next);
  };
  if (api.command) {
    const disposeCommand = api.command.register(() => [{
      title: "Toggle Go Costs",
      value: "model-costs.toggle",
      description: "Show/hide the Go model costs sidebar",
      category: "Model Costs",
      slash: {
        name: "toggle-costs"
      },
      onSelect: toggle
    }]);
    api.lifecycle.onDispose(() => disposeCommand());
  }
  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content(_ctx, _props) {
        return _$createComponent(Show, {
          get when() {
            return enabled();
          },
          get children() {
            return _$createComponent(SidebarContentView, {
              api: api,
              items: items,
              baseline: baseline,
              get sessionID() {
                return _props.session_id;
              }
            });
          }
        });
      }
    }
  });
};
const pluginModule = {
  id: "model-costs",
  tui
};
export default pluginModule;