# tui-plugin Specification

## Purpose
Define el panel de costes como plugin TUI de OpenCode: se carga tanto en V1 como
en V2 y muestra en el sidebar de la sesión los modelos Go ordenados por consumo
de cuota.

## Requirements

### Requirement: Módulo TUI compatible con V1 y V2

El entrypoint TUI SHALL exportar por `default` un objeto con un `id` y las dos
variantes de carga: una función `tui` para OpenCode V1 y una función `setup`
para OpenCode V2. Cada runtime SHALL usar la suya e ignorar la otra.

#### Scenario: Carga en OpenCode V1

- **WHEN** OpenCode V1 carga el módulo y encuentra la función `tui`
- **THEN** registra el plugin y el panel funciona sin error

#### Scenario: Carga en OpenCode V2

- **WHEN** OpenCode V2 valida el `default` (exige `id` no vacío y `setup` función)
- **THEN** el módulo es aceptado y `setup` registra el panel, sin el error
  `Invalid V2 TUI plugin module`

### Requirement: Panel en el sidebar de la sesión

El plugin SHALL registrar el panel `Costs` dentro del sidebar de la sesión y
mostrar una fila por cada modelo Go, con el multiplicador de consumo y el nombre.

#### Scenario: Panel visible

- **WHEN** el plugin está activo y hay modelos Go disponibles
- **THEN** el sidebar muestra la cabecera `▼ Costs` con la lista de modelos

#### Scenario: Panel colapsable

- **WHEN** el usuario activa la cabecera `Costs`
- **THEN** el panel alterna entre expandido y colapsado y, colapsado, muestra el
  número de modelos

### Requirement: Ranking por consumo de cuota

El plugin SHALL ordenar los modelos por tasa de consumo de cuota (coste mezclado
por 1M de tokens dividido por el límite de uso del modelo) relativa al modelo
base, y SHALL colorear cada multiplicador por umbral.

#### Scenario: Orden y color por umbral

- **WHEN** el panel muestra los modelos
- **THEN** se ordenan de menor a mayor consumo relativo y el color es verde con
  `≤1.5x`, amarillo con `≤5x` y rojo con `>5x`

#### Scenario: Modelo sin datos

- **WHEN** un modelo no tiene precio o no tiene límite de uso documentado
- **THEN** se muestra con `?` y se ordena al final, sin multiplicador numérico

#### Scenario: Modelo ilimitado y modelo reciente

- **WHEN** un modelo es gratuito/ilimitado o se publicó en los últimos 30 días
- **THEN** el primero muestra `0.0x` y el segundo lleva la marca `✦`

### Requirement: Modelo activo marcado

El plugin SHALL marcar con `●` el modelo actualmente seleccionado.

#### Scenario: Cambio de modelo activo

- **WHEN** el usuario cambia el modelo activo de la sesión
- **THEN** el panel marca el nuevo modelo con `●` y deja de marcar el anterior

### Requirement: Estado de la UI persistente

El plugin SHALL recordar si el panel está visible y si está colapsado entre
reinicios y reaperturas.

#### Scenario: Estado recordado

- **WHEN** el usuario oculta o colapsa el panel y vuelve a abrir OpenCode
- **THEN** el panel conserva ese estado

### Requirement: Comando para alternar el panel

El plugin SHALL exponer un comando `/toggle-costs` que muestra u oculta el panel,
funcionando tanto en V1 como en V2.

#### Scenario: Alternar con el comando

- **WHEN** el usuario ejecuta `/toggle-costs`
- **THEN** el panel alterna entre visible y oculto

### Requirement: Aviso cuando faltan los límites

El plugin SHALL mostrar `[OpenCode Go] limits unavailable` en lugar de filas
cuando no puede cargar la tabla de límites de uso.

#### Scenario: Límites no disponibles

- **WHEN** el plugin no puede obtener los límites ni desde la red ni de la caché
- **THEN** el panel muestra el aviso de límites no disponibles en vez de modelos
