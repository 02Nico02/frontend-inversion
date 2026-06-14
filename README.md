# Frontend Inversión

Base Angular para analizar `Historial Sueldo.xlsm` desde el navegador, sin backend y sin subir el archivo a ningún servidor.

## Qué incluye esta base

- Importación local de `.xlsm` / `.xlsx`.
- Detección de tablas reales del workbook.
- Mapeo de las tablas críticas:
  - `Tabla6`
  - `TablaPosiciones`
  - `Tabla5`
  - `Tabla14`
- Integración inicial de:
  - `Tabla47`
  - `ObjetivosPorEspecie`
  - `AlertasSuperoElMaximo`
  - `AlertasDebajoDelMinimo`
  - señales `5D` / `30D`
  - `HistorialMensualReconstruido`
  - `Tabla60`
  - `Tabla35`
  - `Tabla38`
  - `Tabla39`
- Dashboard inicial con:
  - cards resumen
  - validación del archivo
  - tabla de posiciones
  - gráficos
  - alertas combinadas
  - salud de datos
  - concentración de portafolio

## Mapeo del Excel

La documentación viva del workbook está en [docs/excel-mapping.md](docs/excel-mapping.md).

Ahí se detalla:

- qué tablas usa la app;
- qué hoja aporta cada tabla;
- qué columnas consume;
- qué interpreta la UI como `positionType` y como `assetType`;
- qué tablas siguen siendo futuras o auxiliares;
- qué partes del Excel requieren revisión de escala o interpretación.

## Requisitos

- Node.js 22 o superior.
- npm.

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run start
```

## Build

```bash
npm run build
```

## Workbook esperado

El frontend espera leer estas tablas como fuente principal:

- `Tabla6` en hoja `inversiones`
- `TablaPosiciones` en hoja `inversiones`
- `Tabla5` en hoja `Historial Inversiones`
- `Tabla14` en hoja `Historial Inversiones`
- `Tabla47` como clasificación auxiliar
- `ObjetivosPorEspecie` como alertas manuales

Opcionales, sin romper la app si faltan:

- `AlertasSuperoElMaximo`
- `AlertasDebajoDelMinimo`
- `EspeciesEnCaida_5D`
- `EspeciesEnRecuperacion_5D`
- `EspeciesEnCaida_30D`
- `EspeciesEnRecuperacion_30D`
- `HistorialMensualReconstruido`
- `Tabla60`
- `Tabla35`
- `Tabla38`
- `Tabla39`

## Tablas críticas

Si falta alguna de estas, la validación lo marca como error:

- `Tabla6`
- `TablaPosiciones`
- `Tabla5`
- `Tabla14`

## Cálculos principales

- `Valor actual ARS` = suma de `TOTAL ACTUAL` para posiciones con moneda normalizada `ARS`.
- `Valor actual USD` = suma de `TOTAL ACTUAL` para posiciones con moneda normalizada `USD`.
- `Total invertido` = suma de `TOTAL INV`.
- `Resultado` = `TOTAL ACTUAL - TOTAL INV`.
- `Resultado %` = `Resultado / Total invertido`.
- `Peso %` = `TOTAL ACTUAL de la especie / TOTAL ACTUAL de la moneda`.
- `Concentración Top N` = suma de los pesos de las N posiciones más grandes dentro de la moneda filtrada.

## Limitaciones conocidas

- No hay backend.
- No persiste datos.
- El Excel sigue siendo la fuente de verdad.
- No se convierten monedas automáticamente.
- `Sin conversión` mezcla monedas solo como referencia visual.
- `Tabla35` requiere revisión de escala si los montos parecen inconsistentes.
- Algunas tablas opcionales pueden no estar presentes y la app sigue funcionando.

## Cómo adaptar el mapeo

- Editá `src/app/core/services/workbook-mapping.service.ts`.
- Agregá alias si cambia el nombre de una tabla.
- Ajustá las columnas esperadas si el Excel cambia.
- Si aparece una tabla nueva, agregala al listado de expectativas y al mapeo del `PortfolioCalculatorService`.

## Observación técnica

La app parsea el `.xlsm` directamente en el navegador usando `jszip` y XML interno del workbook. Eso permite detectar tablas reales sin ejecutar macros.
