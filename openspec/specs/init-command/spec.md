# init-command Specification

## Purpose

Permite instalar el plugin en OpenCode con un solo comando, registrándolo de
forma segura e idempotente en el arreglo `plugin` del config global del usuario.

## Requirements

### Requirement: Comando init de instalación

El paquete SHALL exponer un comando CLI `init` ejecutable mediante su `bin`
publicado, de modo que el usuario pueda invocarlo con
`npx @aaronsr-54/opencode-go-model-costs init`.

#### Scenario: El comando init se ejecuta

- **WHEN** el usuario ejecuta `npx @aaronsr-54/opencode-go-model-costs init`
- **THEN** el paquete arranca el comando `init` y realiza el alta del plugin en
  el config global de OpenCode

#### Scenario: No hay comando o argumento reconocido

- **WHEN** el paquete se ejecuta sin el subcomando `init` o con uno desconocido
- **THEN** el comando muestra la ayuda de uso y termina con un código de salida
  distinto de cero, sin modificar ningún archivo

### Requirement: Resolución del archivo de config global

El comando SHALL registrar el plugin en el config global de OpenCode,
resolviendo el directorio como `$XDG_CONFIG_HOME/opencode` cuando
`XDG_CONFIG_HOME` esté definido y como `~/.config/opencode` en caso contrario.

#### Scenario: XDG_CONFIG_HOME está definido

- **WHEN** la variable de entorno `XDG_CONFIG_HOME` tiene un valor
- **THEN** el comando opera sobre `$XDG_CONFIG_HOME/opencode`, no sobre
  `~/.config/opencode`

#### Scenario: XDG_CONFIG_HOME no está definido

- **WHEN** `XDG_CONFIG_HOME` no tiene valor
- **THEN** el comando opera sobre `~/.config/opencode`

### Requirement: Selección del archivo de config existente

El comando SHALL detectar un archivo de config existente en el directorio de
config, prefiriendo `opencode.json` y usando `opencode.jsonc` cuando sea el
único presente.

#### Scenario: Existe opencode.json

- **WHEN** el directorio de config contiene `opencode.json`
- **THEN** el comando escribe en `opencode.json`

#### Scenario: Solo existe opencode.jsonc

- **WHEN** el directorio de config no contiene `opencode.json` pero sí
  `opencode.jsonc`
- **THEN** el comando escribe en `opencode.jsonc`

### Requirement: Creación del config cuando no existe

Cuando no existe ningún archivo de config en el directorio, el comando SHALL
crear `opencode.json` con el `$schema` de OpenCode y un arreglo `plugin` que
contenga el paquete.

#### Scenario: Primer uso sin config

- **WHEN** el usuario ejecuta `init` y el directorio de config no existe o está
  vacío
- **THEN** el comando crea `opencode.json` con `$schema` de OpenCode y
  `plugin: ["@aaronsr-54/opencode-go-model-costs"]`

### Requirement: Alta preservando el contenido existente

Al añadir el paquete a un config existente, el comando SHALL preservar el resto
del contenido (otras claves y otras entradas del arreglo `plugin`) y los
comentarios cuando el archivo sea JSONC.

#### Scenario: Config con otros plugins y comentarios

- **WHEN** el config contiene otras entradas en `plugin` y comentarios JSONC
- **THEN** el comando agrega `@aaronsr-54/opencode-go-model-costs` al arreglo
  `plugin` y mantiene intactos el resto de claves, entradas y comentarios

#### Scenario: Config sin arreglo plugin

- **WHEN** el config existe pero no tiene la clave `plugin`
- **THEN** el comando crea el arreglo `plugin` con el paquete sin alterar las
  demás claves existentes

### Requirement: Idempotencia

El comando SHALL ser idempotente: si el paquete ya está presente en el arreglo
`plugin`, no SHALL duplicar la entrada ni modificar el archivo.

#### Scenario: Ejecución repetida

- **WHEN** el usuario ejecuta `init` y el paquete ya figura en `plugin`
- **THEN** el comando no agrega una segunda entrada, deja el archivo sin cambios
  y reporta que ya estaba instalado

### Requirement: Reporte del resultado

Tras completar el alta, el comando SHALL informar por consola el archivo
modificado y recordar al usuario reiniciar OpenCode para que el plugin se cargue.

#### Scenario: Alta exitosa

- **WHEN** el comando agrega el paquete al config correctamente
- **THEN** imprime la ruta del archivo modificado y una indicación de reiniciar
  OpenCode, y termina con código de salida cero

### Requirement: Manejo de errores sin corromper el config

Si el archivo de config existe pero no puede leerse o no es JSON/JSONC válido,
el comando SHALL abortar sin sobrescribir el archivo, reportar el problema y
terminar con un código de salida distinto de cero.

#### Scenario: Config inválido

- **WHEN** el archivo de config existente contiene JSON inválido
- **THEN** el comando no modifica el archivo, informa el error y devuelve un
  código de salida distinto de cero
