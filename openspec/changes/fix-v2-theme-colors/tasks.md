# Tasks

## 1. Resolver de color en el núcleo

- [x] 1.1 Implementar `resolveColor(value)` en `tui-core.js` (string no vacío tal cual; objeto `RGBA` por `toInts`/`buffer` tal cual; objeto con `base` propio → resolver `base`; búsqueda superficial como último recurso; si no, `""`) y exportarlo; verificar con casos unitarios nuevos en `test/tui-core.test.js` que pasan con `node --test test/tui-core.test.js`.
- [x] 1.2 Reescribir `v2Theme` sobre `resolveColor` para los tokens `text.base`, `text.muted`, `text.faint`, `text.action.primary` y `text.feedback.{success,warning,error}`; verificar con tests que cubren `RGBA` (fake `{ toInts() }`), envoltorio stateful `{ base, hovered }`, `string` y token ausente (`""`), y que pasan con `node --test test/tui-core.test.js`.
- [x] 1.3 Enrutar `v1Theme` por `resolveColor` manteniendo el pass-through de `RGBA` y de la paleta actual; verificar que los casos existentes de `v1Theme` siguen pasando con `node --test test/tui-core.test.js`.

## 2. Adaptador TUI, tipos y documentación

- [x] 2.1 Cambiar el tipo `PanelTheme` de `tui.tsx` a `string | RGBA` (import `type` desde `@opentui/core`) sin tocar estructura, cálculo ni orden; verificar que `npm run build` regenera `tui.js` y que `node --test test/tui-plugin.test.js` pasa.
- [x] 2.2 Añadir al harness V2 de `test/tui-plugin.test.js` un token de tema con valor `RGBA` y comprobar que `v2Theme` lo resuelve (no `""`); verificar con `node --test test/tui-plugin.test.js`.
- [x] 2.3 Actualizar el README (secciones Rendering rules / Compatibility) para describir que el color se resuelve tanto de cadenas como de valores `RGBA`/stateful del tema en V1 y V2; verificar leyendo el texto generado contra el comportamiento implementado.

## 3. Verificación de integración

- [x] 3.1 Ejecutar la suite completa `npm test` y verificar que todos los tests pasan sin regresiones en el cálculo, el orden y el shape del módulo.
- [x] 3.2 Ejecutar el smoke opcional contra un binario V2 (`OPENCODE_BIN`) si está disponible y verificar que el panel aparece con colores; si no hay binario, confirmar que el test queda saltado.

## Workflow follow-up

- Archivar el cambio tras la revisión del proyecto.
- Verificar el resultado archivado y sincronizar la spec `tui-plugin`.
