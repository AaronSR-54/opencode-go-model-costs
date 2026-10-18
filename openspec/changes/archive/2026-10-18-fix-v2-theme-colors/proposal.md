# Proposal

## Why

En OpenCode V2 el panel `Costs` se dibuja sin color: los multiplicadores no
muestran el verde/amarillo/rojo por umbral y los nombres y cabeceras pierden su
tono. El tema de la TUI V2 entrega los tokens como objetos `RGBA` de OpenTUI
(p. ej. `text.base` es un buffer `[237,238,233,255]`) y, para los tokens
stateful, como envoltorios `{ base, hovered, …, state() }`. La resolución actual
(`statefulColor` en `tui-core.js`) sólo acepta `string`, así que cada token V2
cae en el caso por defecto y devuelve `""`; con `fg=""` OpenTUI usa el color por
defecto del terminal. V1 no se ve afectado porque entrega `RGBA` directamente al
`fg`, que es un `ColorInput` válido. Verificado con una sonda contra OpenCode
2.0.32.

## What Changes

- Un resolver de color compartido (en `tui-core.js`) que devuelve un `ColorInput`
  utilizable tanto si el token es un `string` (temas personalizados o V1
  antiguos) como si es un `RGBA` de OpenTUI, y que desempaqueta los tokens
  stateful tomando su `base`.
- `v2Theme` deja de devolver `""` para los tokens de V2 y pasa a devolver el
  valor de color real (`RGBA` o `string`).
- `v1Theme` mantiene su comportamiento observable (pass-through de `RGBA`),
  unificado sobre el mismo resolver.
- El tipo `PanelTheme` acepta valores de color (`string | RGBA`) en lugar de
  sólo `string`.
- Tests del núcleo que cubren tokens `RGBA`, envoltorios stateful, strings y
  tokens ausentes, replicando la forma real del tema V2.
- Nota breve en el README sobre la resolución de color en V1/V2.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities

- `tui-plugin`: el requisito de color por umbral pasa a exigir que el panel
  aplique el color correspondiente en ambos runtimes, incluyendo el runtime V2
  (`RGBA` y tokens stateful), en vez de asumir valores `string`.

## Impact

- `tui-core.js`: `statefulColor` se sustituye por un resolver de `ColorInput`;
  `v1Theme` y `v2Theme` lo usan.
- `tui.tsx`: el tipo `PanelTheme` pasa de `string` a un tipo de color aceptado
  por `fg`; sin cambios de estructura, cálculo ni orden.
- `test/tui-core.test.js` y `test/tui-plugin.test.js`: nuevos casos con `RGBA` y
  tokens stateful; los casos existentes con `string` siguen valiendo.
- Sin cambios en `server.js`, `bin/init.js`, el cálculo de burn rate, el fetch de
  límites, el shape del módulo (`{ id, tui, setup }`) ni el empaquetado.
- Sin nuevas dependencias: el resolver es duck-typing puro, sin importar
  `@opentui/core` (mantiene `tui-core.js` libre de runtime).
