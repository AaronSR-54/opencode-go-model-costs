# opencode-go-model-costs

OpenCode TUI plugin that ranks OpenCode Go models by **plan-quota burn rate** — how fast each model consumes your Go usage windows (5h / weekly / monthly) — directly in the sidebar.

![screenshot](screenshot.png)

## Features

- Ranks models by quota consumption, not raw price: a model with a $15 usage limit burns your plan 4x faster than one with a $60 limit at the same dollar cost
- Usage limits are looked up at runtime from the official docs, not hardcoded, so new/changed models are picked up automatically
- Multiplier is relative to the baseline (`minimax-m2.7`): `1.0x` = burns quota at the same rate
- Models missing a price or a documented limit show `?`; free/unlimited models show `0.0x`
- Color-coded: green (≤1.5x), yellow (≤5x), red (>5x)
- Marks models released in the last 30 days with a `✦` tag
- Truncates long model names (`…`) so rows never overflow the sidebar
- Highlights the currently active model
- Toggle sidebar visibility via `/toggle-costs`

## How it's calculated

Go meters usage as `cost × (60 / model_usage_limit)` against shared dollar windows
(see the [Usage column](https://opencode.ai/docs/go/#usage-limits) in the official docs).
The plugin therefore scores each model as:

```
burn = blended_cost_per_1M_tokens / usage_limit
mult = burn / burn(minimax-m2.7)
```

where `blended_cost = input + output * 0.3` per 1M tokens.

Prices come from the provider catalog (models.dev); usage limits are parsed
from the monthly-limit table at
[`opencode.ai/docs/go.md`](https://opencode.ai/docs/go.md) and cached for 12h.
The base "Go" table is used — Go Plus scales every limit by the same factor,
so rankings are identical.

## Install

Add to your `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["@aaronsr-54/opencode-go-model-costs"]
}
```

Restart opencode and the sidebar will appear automatically.

### Migration

`@aaronsr-54/openode-go-model-costs` is deprecated. Replace it with
`@aaronsr-54/opencode-go-model-costs` in your OpenCode configuration.

## Usage

- **Toggle**: Run `/toggle-costs` to show/hide the sidebar
- **Colors**: Green = low quota burn, Yellow = moderate, Red = high
- **`?`**: usage limit unknown for that model (or price missing)
- **`0.0x`**: free/unlimited model, consumes no quota
- **✦**: model released in the last 30 days

If the limits can't be loaded (offline and no cached copy), the sidebar shows
a `limits unavailable` notice instead of model rows. A cached copy is reused
whenever the network is down.

## Links

- [npm](https://www.npmjs.com/package/@aaronsr-54/opencode-go-model-costs)
- [GitHub Packages](https://github.com/AaronSR-54/opencode-go-model-costs/packages)
- [GitHub](https://github.com/AaronSR-54/opencode-go-model-costs)
