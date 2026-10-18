# Design

## Context

Ver `proposal.md` - Why. Estado actual relevante:

- `tui-core.js` es un núcleo puro, sin imports ni API de runtime, compartido por
  V1 y V2 y testeable con `node --test`.
- `v1Theme(current)` recibe el `TuiThemeCurrent` de V1 (campos planos, tipo
  `RGBA` de OpenTUI: `text`, `textMuted`, `accent`, `success`, …) y los reenvía
  tal cual al `fg`; por eso V1 colorea bien.
- `v2Theme(theme)` + `statefulColor(value)` intentan resolver el tema de V2
  asumiendo valores `string`: si no encuentran un `string`, devuelven `""`.
- Sonda contra OpenCode 2.0.32: `context.theme` de un plugin TUI V2 expone
  `currentTokens()` con `hue`, `text`, `background`, `border`, `scrollbar`,
  `diff`, `syntax`, `markdown`, `categorical` y funciones `source`, `increase`,
  `decrease`, `surface`. Los valores hoja son `RGBA` de OpenTUI (con
  `buffer`/`toInts()`), y los tokens stateful (`text.action.primary`,
  `text.formfield`, …) son envoltorios `{ base, hovered, focused, pressed,
  selected, disabled, state() }`.
- `fg`/`backgroundColor` aceptan `ColorInput = string | RGBA`
  (`@opentui/core/lib/RGBA.d.ts`), que es lo que usan los componentes internos
  de la TUI V2 al pasar tokens del tema directamente.
- El build de `tui.tsx` es Babel (`babel-preset-solid` + `preset-typescript`);
  los tipos se borran, no hay typecheck en CI.

## Goals / Non-Goals

**Goals:**

- Que el panel aplique el color resuelto del tema en V2, además de en V1.
- Un único resolver de color compartido, sin acoplar `tui-core.js` a
  `@opentui/core`.
- No cambiar el comportamiento observable de V1 ni el cálculo/orden del panel.
- Tests que reflejen la forma real del tema V2 (`RGBA` + tokens stateful).

**Non-Goals:**

- Cambiar umbrales (`≤1.5x`, `≤5x`), el cálculo de burn rate o el orden.
- Rediseñar la elección de acento o el layout/estilo del panel.
- Añadir configuración de tema propia al plugin.
- Resolver superficies concretas del tema (`theme.surface(...)`): se usan los
  tokens raíz que expone el contexto del plugin.
- Elegir un color de acento "más colorido" (p. ej. `hue.accent`); se mantiene la
  preferencia actual por `text.action.primary`.

## Decisions

### D1. Pasar el valor de color tal cual, sin convertir a hex

El resolver devuelve un `ColorInput` utilizable: `string` no vacío o el objeto
`RGBA` recibido. Evidencia: `fg` acepta `string | RGBA`, los componentes de la
propia TUI V2 pasan los tokens del tema directamente al `fg`, y convertir a hex
obligaría a importar `@opentui/core` o a leer `RGBA.buffer` (campo interno) y
perdería la intención de color (indexado/transparencia). Alternativas
descartadas: `rgbToHex` (acopla el núcleo puro a OpenTUI), leer `.buffer` a mano
(depende de un detalle interno), devolver `number` (no es un `ColorInput`).

### D2. Detección por duck-typing y desempaquetado de stateful

`resolveColor(value)`:

1. `string` no vacío → se devuelve tal cual (temas personalizados o temas V1
   antiguos).
2. Objeto con `toInts` función o con `buffer` numérico/`Uint16Array` → es un
   `RGBA`: se devuelve el objeto.
3. Objeto con propiedad propia `base` → se resuelve `base` (token stateful).
4. Otro objeto → se busca superficialmente el primer valor resoluble (mantiene
   la tolerancia actual) y, si no hay, se devuelve `""`.
5. Cualquier otro caso → `""` (equivale a "color por defecto", sin romper el
   render).

Alternativa descartada: llamar a `state()` del token stateful, que necesita un
objeto de estado concreto y complica la detección sin aportar nada al panel.

### D3. V1 pasa por el mismo resolver

`v1Theme` sigue siendo pass-through (`RGBA` ya es un `ColorInput`), pero se
enruta por `resolveColor` para tener una sola ruta de color y cubrir temas V1
con `string`. No cambia el comportamiento observable de V1.

### D4. Tipos del panel

`PanelTheme` deja de declarar `string` y pasa a `string | RGBA` (import `type`
desde `@opentui/core`, que ya es peer dependency y solo se borra en el build).
Es un cambio cosmético para el compilador; el runtime no cambia.

### D5. Tests con fixtures fieles a V2

Se añaden casos en `test/tui-core.test.js` con un `RGBA` falso
(`{ toInts() {...} }`) para verificar: (a) pass-through del objeto `RGBA`, (b)
desempaquetado de `{ base, hovered, … }`, (c) `string` tal cual, (d) token
ausente → `""`, (e) los tokens reales del panel (`text.base`, `text.muted`,
`text.faint`, `text.action.primary`, `text.feedback.*`). Los casos existentes
con `string` se conservan. En `test/tui-plugin.test.js` se puede añadir un token
`RGBA` al harness para cubrir el camino V2 de punta a punta sin binario.

## Risks / Trade-offs

- [Heurística de detección de `RGBA`] → mitigado exigiendo `toInts` o `buffer`
  numérico; si un objeto no encaja, cae a `base`/búsqueda/`""` sin lanzar.
- [Cambios futuros en la forma del `RGBA` de OpenTUI] → el resolver acepta
  strings y objetos, y ante duda usa el color por defecto (nunca crashea).
- [Sin binario V2 en CI] → los escenarios se validan con fixtures que replican la
  forma real medida en 2.0.32; el smoke opcional con `OPENCODE_BIN` sigue
  disponible.
- [Regresión en V1] → sin cambios de comportamiento; los tests actuales de
  `v1Theme` deben seguir pasando.
- [Pasar objetos `RGBA` al JSX] → son inmutables y compartidos por el tema; no
  hay coste reseñable ni mutación.

## Migration Plan

- Cambio aditivo/correctivo en `tui-core.js` y limpieza de tipos en `tui.tsx`.
- Sin migración de datos ni de configuración; el usuario solo actualiza y
  reinicia OpenCode para que V2 recargue el plugin.
- Rollback: revertir `tui-core.js`, `tui.tsx`/`tui.js` y los tests; el resto del
  paquete no cambia.
- Despliegue: bump patch y publicación estándar.
