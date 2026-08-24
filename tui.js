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
const NAME_MAX_CHARS = 28;
function clipName(name, max) {
  if (max < 4) max = 4;
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

// Monthly usage included with each model on the OpenCode Go plan ($).
// Source: https://opencode.ai/docs/go/ ("Usage" column). Models missing
// from this map have no known limit and fall back to raw cost ranking.
// Usage is metered as cost / limit, so a $15 model burns quota 4x faster
// than a $60 one at the same dollar price.

const USAGE_LIMITS = {
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
  hy3: 60
};
const BASELINE_MODEL = "minimax-m2.7";
const BASELINE_FALLBACK_COST = 0.66;
const BASELINE_FALLBACK_LIMIT = 60;
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

  // Quota burn rate: share of the model's own monthly usage allowance
  // consumed per blended 1M tokens. This is what actually depletes the
  // shared 5h/weekly/monthly windows.
  const baseLimit = USAGE_LIMITS[BASELINE_MODEL] ?? BASELINE_FALLBACK_LIMIT;
  const baseCost = models[BASELINE_MODEL]?.cost;
  const BASELINE_BURN = (baseCost ? baseCost.input + baseCost.output * 0.3 : BASELINE_FALLBACK_COST) / baseLimit;
  function limitOf(id) {
    return USAGE_LIMITS[id.split("/").pop() || id] ?? null;
  }
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
  const fmtMult = n => n >= 10 ? Math.round(n) + "x" : n.toFixed(1) + "x";
  const items = entries.map(([id, m]) => {
    const c = m.cost;
    const recent = isRecent(m);
    if (!c) {
      return {
        id,
        name: m.name || id,
        mult: "?",
        score: null,
        burn: null,
        limit: null,
        recent
      };
    }
    const sc = c.input + c.output * 0.3;
    const limit = limitOf(id);
    if (limit && limit > 0) {
      const burn = sc / limit; // % of monthly allowance per 1M tok (fraction)
      return {
        id,
        name: m.name || id,
        score: sc,
        burn,
        limit,
        mult: fmtMult(burn / BASELINE_BURN),
        recent
      };
    }
    // Unknown usage limit: rank by raw price against the baseline cost.
    const rawMult = sc / (BASELINE_BURN * baseLimit);
    return {
      id,
      name: m.name || id,
      score: sc,
      burn: null,
      limit: null,
      mult: "~" + fmtMult(rawMult),
      recent
    };
  }).sort((a, b) => {
    const ka = a.burn ?? a.score ?? Infinity;
    const kb = b.burn ?? b.score ?? Infinity;
    return ka - kb;
  });
  return {
    items,
    baseline: BASELINE_BURN
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
          _$insertNode(_el$11, _$createTextNode(`use/1M tok`));
          _$setProp(_el$11, "fg", "#555555");
          _$insert(_el$9, () => props.items.map(m => {
            const mx = m.burn !== null ? m.burn / props.baseline : 99;
            const active = isActive(m.id);
            const costFg = m.score ? costColor(mx, props.api.theme.current) : props.api.theme.current.textMuted;
            const nameFg = active ? props.api.theme.current.accent : props.api.theme.current.textMuted;
            const tag = m.recent ? "✦ " : "";
            const label = clipName(m.name, NAME_MAX_CHARS - tag.length);
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
              _$insert(_el$16, tag);
              _$setProp(_el$17, "fg", nameFg);
              _$setProp(_el$17, "wrapMode", "none");
              _$insert(_el$17, label);
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