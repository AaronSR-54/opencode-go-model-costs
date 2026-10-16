# Design

## Context

Ver `proposal.md` - Why. El paquete hoy se publica como un plugin de OpenCode
(`server.js` + `tui.js`), con `"type": "module"` y sin dependencias de runtime
propias más allá de las del TUI. No tiene `bin`, ni tests, ni carpeta `src`.

Restricciones del entorno real observado:

- El config global puede ser `opencode.json` **o** `opencode.jsonc`. En esta
  máquina es `opencode.jsonc` con comentarios `//` y otras claves (`provider`,
  `skills`, `mcp`), por lo que preservar formato y comentarios es obligatorio.
- OpenCode resuelve el config global en `~/.config/opencode`, con
  `$XDG_CONFIG_HOME` como base cuando está definido.
- El usuario instala el plugin vía `npx`, por lo que el comando debe funcionar
  como un binario Node autocontenido.

## Goals / Non-Goals

**Goals:**

- Un único comando `init` que deje el plugin registrado en el config global.
- Edición quirúrgica y comentario-segura de JSON/JSONC.
- Comportamiento idempotente y seguro ante archivos inválidos.
- Lógica de edición aislada y testeable sin tocar el sistema de archivos real.

**Non-Goals:**

- Soportar config de proyecto (`./opencode.json`); el default es solo global.
- Migrar o eliminar el paquete deprecado `@aaronsr-54/openode-go-model-costs`.
- Instalar dependencias, reiniciar OpenCode o validar la versión del CLI de
  OpenCode.
- Cambiar el comportamiento del plugin TUI en runtime.

## Decisions

### D1. Binario Node con shebang, ESM

Se añade `"bin": { "opencode-go-model-costs": "./bin/init.js" }` a `package.json`
y `bin/init.js` con `#!/usr/bin/env node`. El archivo es JS plano ESM (sin build),
coherente con `"type": "module"`.

- Alternativa descartada: registrar un comando dentro de OpenCode (slash
  command). No sirve para el primer uso, porque el plugin aún no está cargado.
- Alternativa descartada: `postinstall` automático. Efecto secundario silencioso
  al instalar; el usuario pidió un comando explícito.

### D2. Editor JSONC con `jsonc-parser`

Se usa `jsonc-parser` (`parse` para validar, `modify` + `applyEdits` para editar)
para insertar la entrada en el arreglo `plugin` preservando comentarios y
formato existentes.

- Alternativa descartada: `JSON.parse` + `JSON.stringify`. Pierde comentarios y
  reformatea todo el archivo; rompe el requisito de preservación.
- Alternativa descartada: editor de texto propio. Mayor superficie de bugs y
  casos borde (arrays vacíos, claves ausentes, comas) ya resueltos por la lib.

### D3. Resolución de ruta

`base = process.env.XDG_CONFIG_HOME ? join(XDG_CONFIG_HOME, "opencode") : join(homedir(), ".config", "opencode")`.
Dentro, preferir `opencode.json`; si no existe y sí `opencode.jsonc`, usar este;
si ninguno existe, crear `opencode.json`.

### D4. Idempotencia por nombre de paquete

Se compara el nombre del paquete normalizado (sin sufijo `@version`, p. ej.
`@aaronsr-54/opencode-go-model-costs@latest` → `@aaronsr-54/opencode-go-model-costs`)
contra las entradas existentes de `plugin`. Si ya está, no se escribe nada.

### D5. Lógica pura separada del CLI

Toda la manipulación de texto vive en funciones puras
(`isInstalled(configText, pkg)`, `addPackage(configText, pkg)`), y `bin/init.js`
solo hace I/O, resolución de rutas y mensajes. Esto permite testear con
`node:test` sin depender del home del usuario.

### D6. Mensajes en inglés

El código, comentarios y README del repo están en inglés; los mensajes de consola
del comando siguen esa convención para ser consistentes con la superficie
pública ya existente.

### D7. Tests con `node:test`

Se añaden tests unitarios de las funciones puras (instalado/no instalado, JSONC
con comentarios, sin clave `plugin`, JSON inválido) usando el runner integrado de
Node, sin dependencias nuevas. Se añade un script `test`.

## Risks / Trade-offs

- **Comentarios y formato JSONC** → cubierto por `jsonc-parser`; se testea con un
  fixture con comentarios y claves vecinas.
- **`$XDG_CONFIG_HOME` relativo o vacío** → tratar valor vacío como ausente;
  documentar que rutas relativas se resuelven contra el cwd.
- **Nueva dependencia de runtime** (`jsonc-parser`) → es pequeña y sin
  transitivas; aceptable frente a reescribir un editor JSONC.
- **Colisión de nombre de bin** con otros paquetes → el nombre incluye el
  paquete; `npx @aaronsr-54/opencode-go-model-costs init` resuelve el bin único.
- **El usuario ya tiene la entrada con otra versión/alias** → la comparación por
  nombre normalizado evita duplicados.

## Migration Plan

- No hay migración de datos: es un comando nuevo y aditivo.
- Rollback: eliminar la entrada añadida por el comando o revertir el commit;
  los usuarios ya instalados a mano no se ven afectados (idempotencia).
- Secuencia de despliegue: bump de versión y publicación estándar del paquete
  (`bin` y `files` incluidos).

## Open Questions

- Ninguna que afecte specs, enfoque o desglose de tareas.
