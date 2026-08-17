# Auditoría UX del frontend de inversiones

## 1. Resumen ejecutivo

La aplicación resuelve bien el análisis financiero, pero la navegación actual está organizada por pantallas técnicas y no por flujo de uso. Eso genera tres problemas principales:

1. El sidebar está plano y mezcla niveles de profundidad muy distintos.
2. `Resumen` concentra demasiada información y duplica parte del análisis profundo que ya existe en otras pestañas.
3. Hay pantallas de mantenimiento, diagnóstico y herramientas que compiten con las pantallas operativas del día a día.

La oportunidad más clara es reordenar la navegación por intención de uso:

- uso semanal: ver estado general, revisar posiciones, decidir acciones, exportar contexto;
- análisis profundo: distribución, concentración, histórico, alertas;
- mantenimiento: importación, revisión de datos, configuración, herramientas.

Además, hay una deuda transversal de nomenclatura y legibilidad:

- varios títulos y textos siguen con caracteres rotos en el código fuente;
- algunos nombres son demasiado técnicos o ambiguos;
- hay duplicaciones de benchmark, alertas, concentración y salud de datos en más de una pantalla.

La recomendación es empezar por la navegación y `Resumen`, luego ordenar `Posiciones` y `Detalle de posición`, y recién después limpiar pantallas secundarias.

## 2. Mapa actual de rutas y menú

### Rutas actuales

| Ruta | Nombre visible | Propósito aparente | Observación UX |
| --- | --- | --- | --- |
| `/resumen` | Resumen | Vista general operativa | Demasiado cargada para ser una portada |
| `/distribucion` | Distribución | Ver composición del portafolio | Se superpone con Concentración |
| `/posiciones` | Posiciones | Tabla operativa principal | Bien ubicada, pero puede ganar jerarquía |
| `/posiciones/:symbol` | Detalle de posición | Análisis profundo de una especie | Correcta, pero densa |
| `/historico` | Histórico | Series históricas y evolución | Muy útil, con varios análisis en una sola vista |
| `/alertas` | Alertas | Alertas manuales y calculadas | Correcta, pero mezcla señales y detalle |
| `/concentracion` | Concentración | Ranking de concentración | Duplica parte de Resumen |
| `/decisiones` | Decisiones | Panel táctico y exportación GPT | Muy importante, debería ser central |
| `/estrategia` | Estrategia | Placeholder / split estratégico | Parece más futura o secundaria |
| `/datos-a-revisar` | Datos a revisar | Auditoría de calidad de workbook | Útil como mantenimiento |
| `/datos-gpt` | Datos GPT | Herramienta de exportación y preparación | Herramienta secundaria, no pantalla principal |
| `/importacion` | Importación | Carga o reemplazo del Excel | Paso inicial claro |
| `/configuracion` | Configuración | Ayuda y limitaciones | En realidad funciona como ayuda/configuración |

### Sidebar actual

El menú lateral actual es una lista plana:

- Resumen
- Distribución
- Posiciones
- Histórico
- Alertas
- Concentración
- Decisiones
- Estrategia
- Datos GPT
- Datos a revisar
- Importación
- Configuración

Problemas del sidebar actual:

- no agrupa por intención;
- no diferencia pantallas principales de herramientas;
- no marca jerarquía entre uso semanal y mantenimiento;
- mezcla pantallas maduras con pantallas de soporte o futuras.

## 3. Diagnóstico por pestaña

### Resumen

**Ruta:** `/resumen`

**Nombre visible:** Resumen

**Propósito actual aparente:** vista general del portafolio para arrancar rápido.

**Secciones principales:**

- KPI general del portafolio;
- comparación vs mínimo ARS;
- tendencia Balance vs mínimo ARS;
- órdenes pendientes;
- próximos hitos;
- salud de datos;
- concentración resumida;
- alertas clave;
- acciones rápidas.

**Qué información aporta realmente:**

- estado operativo general;
- riesgo y benchmark;
- señales de acción rápida;
- estado de datos y mantenimiento;
- accesos directos a otras pantallas.

**Qué duplica con otras pestañas:**

- benchmark mínimo y tendencia: Histórico, Posiciones y Detalle de posición;
- concentración: Concentración;
- alertas: Alertas;
- salud de datos: Datos a revisar;
- exportación/acciones: Decisiones y Datos GPT;
- próximos hitos/estrategia: Estrategia y Decisiones.

**Qué cosas parecen sobrar:**

- demasiado detalle en tarjetas de apoyo;
- bloques que requieren lectura larga;
- análisis profundo que no pertenece a una portada.

**Qué podría moverse a otra pestaña:**

- la concentración detallada a Concentración;
- alertas detalladas a Alertas;
- salud de datos a Datos a revisar;
- parte de próximos hitos a Estrategia o Decisiones;
- algunos accesos rápidos a una zona de herramientas.

**Problemas de UX/apariencia detectados:**

- es una pantalla “todo en uno”;
- demasiado contenido para una sola lectura;
- compite entre resumen ejecutivo y dashboard analítico;
- el usuario puede perder el foco en qué acción tomar primero.

**Recomendación:** **mejorar + recortar**

`Resumen` debería quedarse con conclusiones cortas y accionables. El análisis profundo debe vivir en las pestañas específicas.

### Distribución

**Ruta:** `/distribucion`

**Nombre visible:** Distribución

**Propósito actual aparente:** ver distribución por especie, moneda y composición.

**Secciones principales:**

- filtros de moneda;
- gráficos de distribución por especie y moneda;
- tablas/resúmenes asociados según componente.

**Qué información aporta realmente:**

- composición del portafolio;
- lectura rápida de exposición por activo y moneda.

**Qué duplica con otras pestañas:**

- concentración por especie y moneda;
- parte del panorama del resumen;
- parte de la vista operativa de posiciones.

**Qué cosas parecen sobrar:**

- si la información queda muy parecida a Concentración, una de las dos pestañas puede quedar como subtipo o desaparecer.

**Qué podría moverse a otra pestaña:**

- podría integrarse como subvista de Concentración o de Posiciones.

**Problemas de UX/apariencia detectados:**

- nombre algo ambiguo para un usuario final;
- puede confundirse con concentración.

**Recomendación:** **fusionar o mover**

Evaluar si esta pantalla debe convivir con Concentración como vista secundaria.

### Posiciones

**Ruta:** `/posiciones`

**Nombre visible:** Posiciones

**Propósito actual aparente:** tabla operativa principal del portafolio.

**Secciones principales:**

- tabla de posiciones;
- filtros y orden;
- métricas operativas;
- acceso al detalle por especie.

**Qué información aporta realmente:**

- listado para operar;
- acceso a detalle;
- lectura diaria de posición.

**Qué duplica con otras pestañas:**

- parte de resumen y benchmark;
- parte de alertas;
- parte del histórico y detalle.

**Qué cosas parecen sobrar:**

- filtros y columnas que no se usan con frecuencia pueden quedar secundarios;
- exceso de densidad en la tabla puede ocultar la acción principal.

**Qué podría moverse a otra pestaña:**

- análisis de detalle por especie debe permanecer en `/posiciones/:symbol`;
- vistas históricas no deberían vivir acá.

**Problemas de UX/apariencia detectados:**

- si la tabla es muy ancha, cuesta usarla como pantalla operativa;
- necesita priorizar búsqueda, estado y acción.

**Recomendación:** **mantener + mejorar**

Es una pestaña central. Conviene simplificar columnas y reforzar acciones clave.

### Detalle de posición

**Ruta:** `/posiciones/:symbol`

**Nombre visible:** Posiciones / [símbolo]

**Propósito actual aparente:** análisis profundo de una especie.

**Secciones principales:**

- resumen de posición;
- compras / lotes;
- alertas;
- histórico;
- clasificación;
- mínimo esperado;
- movimientos.

**Qué información aporta realmente:**

- visión completa de una sola especie;
- trazabilidad operativa y financiera;
- comparación contra benchmark;
- validación de clasificación y movimientos.

**Qué duplica con otras pestañas:**

- histórico de precio y benchmark: Histórico;
- alertas: Alertas;
- clasificación: Datos a revisar / clasificación global;
- benchmark mínimo: Resumen e Histórico.

**Qué cosas parecen sobrar:**

- demasiados bloques de alto nivel al mismo tiempo;
- la pantalla intenta ser resumen, auditoría e histórico simultáneamente.

**Qué podría moverse a otra pestaña:**

- el gráfico de histórico puede vivir mejor dentro de la pestaña Histórico del detalle;
- parte de clasificación podría simplificarse a un bloque resumido y el resto quedar en Datos a revisar.

**Problemas de UX/apariencia detectados:**

- densidad muy alta;
- varias métricas importantes compiten entre sí;
- riesgo de fatiga visual.

**Recomendación:** **mejorar**

Mantener la pantalla, pero separar mejor el resumen operativo del análisis profundo.

### Histórico

**Ruta:** `/historico`

**Nombre visible:** Histórico

**Propósito actual aparente:** series temporales, evolución diaria, benchmark mínimo e hitos.

**Secciones principales:**

- selector de especie;
- precio histórico;
- evolución diaria;
- Balance vs mínimo ARS;
- hitos del portafolio;
- hitos no disponibles.

**Qué información aporta realmente:**

- lectura temporal de cada especie;
- evolución del portafolio en el tiempo;
- calidad del historial disponible.

**Qué duplica con otras pestañas:**

- benchmark mínimo y tendencia: Resumen y Posiciones;
- algo de señales/alertas temporales: Alertas y Decisiones;
- hitos cercanos: Resumen y Estrategia.

**Qué cosas parecen sobrar:**

- cuando se mezcla demasiado el histórico de especie con el histórico global del portafolio, la pantalla pierde foco.

**Qué podría moverse a otra pestaña:**

- nada obvio; más bien debería ser la pantalla canónica para series temporales.

**Problemas de UX/apariencia detectados:**

- pantalla potente pero compleja;
- necesita jerarquía muy clara entre series, benchmark e hitos.

**Recomendación:** **mantener + mejorar**

Es una pantalla clave y debe quedar como referencia histórica principal.

### Alertas

**Ruta:** `/alertas`

**Nombre visible:** Alertas

**Propósito actual aparente:** centro de señales manuales y calculadas.

**Secciones principales:**

- tabs por tipo de alerta;
- filtros múltiples;
- tarjetas de resumen;
- tablas operativas con acciones.

**Qué información aporta realmente:**

- alertas accionables;
- señales calculadas;
- acceso a detalle de especie.

**Qué duplica con otras pestañas:**

- resumen de alertas en Resumen y Decisiones;
- señales resumidas en Decisiones;
- parte de salud de datos y benchmark.

**Qué cosas parecen sobrar:**

- filtros muy extensos si el usuario solo quiere ver lo relevante;
- demasiados modos en una sola pantalla.

**Qué podría moverse a otra pestaña:**

- resúmenes compactos podrían vivir en Decisiones;
- la lista completa sí debe quedarse acá.

**Problemas de UX/apariencia detectados:**

- puede sentirse como una mesa operativa muy cargada;
- si el usuario entra sin intención clara, la pantalla abruma.

**Recomendación:** **mantener + mejorar**

La vista es útil, pero conviene mejorar la jerarquía y simplificar el primer pantallazo.

### Concentración

**Ruta:** `/concentracion`

**Nombre visible:** Concentración

**Propósito actual aparente:** mostrar concentración principal y ranking top N.

**Secciones principales:**

- filtro de moneda;
- advertencia de moneda;
- métricas Top 1 / 3 / 5 / 10;
- gráfico de concentración;
- ranking top 10.

**Qué información aporta realmente:**

- concentración del portafolio;
- riesgo de concentración;
- ranking de peso relativo.

**Qué duplica con otras pestañas:**

- bloque de concentración en Resumen;
- parte de distribución;
- parte de análisis de riesgos.

**Qué cosas parecen sobrar:**

- si la fórmula es muy parecida a Resumen, no debería duplicarse en un bloque visible de la portada.

**Qué podría moverse a otra pestaña:**

- la concentración resumida debería dejarse solo como teaser en Resumen.

**Problemas de UX/apariencia detectados:**

- el nombre es claro para usuarios técnicos, pero no necesariamente para usuarios operativos;
- se percibe como pantalla de análisis profundo.

**Recomendación:** **mantener**

Es una pantalla útil y específica, aunque debería quedar más claramente dentro del grupo de Análisis.

### Decisiones

**Ruta:** `/decisiones`

**Nombre visible:** Decisiones

**Propósito actual aparente:** panel táctico para actuar y exportar contexto.

**Secciones principales:**

- resumen de decisiones;
- liquidez;
- órdenes pendientes;
- movimientos;
- benchmark mínimo;
- posiciones engañosas;
- alertas activadas;
- simulador;
- performance;
- export GPT;
- señales resumidas.

**Qué información aporta realmente:**

- qué revisar ahora;
- qué comprar, ajustar o evitar;
- contexto exportable para IA;
- visión operativa semanal.

**Qué duplica con otras pestañas:**

- alertas: Alertas;
- benchmark mínimo: Resumen, Histórico y Posiciones;
- posiciones engañosas: Posiciones/Detalle;
- exportación y contexto: Datos GPT;
- parte de estrategia: Estrategia.

**Qué cosas parecen sobrar:**

- tiene varios subpaneles que podrían vivir como pestañas internas o como bloques colapsables;
- puede volverse muy larga si se agrega más contexto.

**Qué podría moverse a otra pestaña:**

- export GPT técnico podría vivir en una herramienta separada;
- simulación podría ser una subherramienta o una pantalla separada si crece.

**Problemas de UX/apariencia detectados:**

- es muy rica funcionalmente, pero corre riesgo de “centro de mando saturado”.

**Recomendación:** **mantener + mejorar**

Debe ser una de las pantallas principales. Conviene ordenar los bloques por prioridad de decisión.

### Estrategia

**Ruta:** `/estrategia`

**Nombre visible:** Estrategia

**Propósito actual aparente:** espacio futuro para split estratégico y objetivos.

**Secciones principales:**

- texto introductorio;
- mención a Tabla35;
- estado casi placeholder.

**Qué información aporta realmente:**

- hoy aporta poco;
- funciona más como promesa de funcionalidad futura.

**Qué duplica con otras pestañas:**

- objetivos cercanos en Resumen;
- planificación en Decisiones.

**Qué cosas parecen sobrar:**

- la pantalla completa podría no ser necesaria todavía.

**Qué podría moverse a otra pestaña:**

- eventualmente podría integrarse en Decisiones o desaparecer del menú hasta que tenga contenido real.

**Problemas de UX/apariencia detectados:**

- parece una pestaña semivacía;
- puede confundir al usuario sobre su utilidad real.

**Recomendación:** **ocultar o fusionar**

Si no tiene contenido sustancial, debería dejar de competir por atención en el menú principal.

### Datos a revisar

**Ruta:** `/datos-a-revisar`

**Nombre visible:** Datos a revisar

**Propósito actual aparente:** auditoría de calidad del workbook.

**Secciones principales:**

- severidad;
- filtros por fuente, especie y texto;
- agrupación por fuente;
- listado de problemas;
- acciones por issue.

**Qué información aporta realmente:**

- problemas de importación, clasificación y calidad;
- priorización de correcciones;
- rastreo de fuentes afectadas.

**Qué duplica con otras pestañas:**

- salud de datos en Resumen;
- algunos diagnósticos que también aparecen en Importación o Configuración.

**Qué cosas parecen sobrar:**

- si se usa poco, puede quedar escondida como herramienta de mantenimiento.

**Qué podría moverse a otra pestaña:**

- algunos diagnósticos podrían integrarse en Importación;
- el resumen de salud podría aparecer comprimido en Resumen.

**Problemas de UX/apariencia detectados:**

- nombre bastante técnico;
- útil, pero no como navegación de primer nivel para usuarios no técnicos.

**Recomendación:** **mantener, pero mover a Herramientas**

Es una herramienta de mantenimiento, no una pantalla principal.

### Datos GPT

**Ruta:** `/datos-gpt`

**Nombre visible:** Datos GPT

**Propósito actual aparente:** construir y exportar contexto editable para ChatGPT.

**Secciones principales:**

- seleccionar especies;
- completar datos;
- exportar Markdown;
- configuración de proveedores;
- importación desde texto;
- preview y exportación.

**Qué información aporta realmente:**

- preparación de contexto para IA;
- edición manual de plantillas;
- autocompletado por proveedor.

**Qué duplica con otras pestañas:**

- exportación y contexto en Decisiones;
- parte de diagnóstico/manualidad podría confundirse con Importación.

**Qué cosas parecen sobrar:**

- si se deja demasiado visible, compite con pantallas centrales;
- es una herramienta, no una pantalla operativa.

**Qué podría moverse a otra pestaña:**

- nada de negocio; solo debería vivir dentro de Herramientas.

**Problemas de UX/apariencia detectados:**

- necesita jerarquía clara de pasos y buen estado visual;
- si se mezcla con navegación principal, confunde.

**Recomendación:** **mantener como herramienta secundaria**

Debe quedar en Herramientas, no entre las pantallas núcleo del portafolio.

### Importación

**Ruta:** `/importacion`

**Nombre visible:** Importación

**Propósito actual aparente:** cargar o reemplazar el Excel local.

**Secciones principales:**

- import panel;
- validación del workbook;
- resumen de archivo y estado.

**Qué información aporta realmente:**

- entrada al sistema;
- reemplazo del workbook;
- diagnóstico inicial de carga.

**Qué duplica con otras pestañas:**

- poco, salvo algún resumen de estado y calidad;
- la acción de cargar también aparece en Resumen como CTA.

**Qué cosas parecen sobrar:**

- no parece sobrar; es una pantalla fundacional.

**Qué podría moverse a otra pestaña:**

- nada importante.

**Problemas de UX/apariencia detectados:**

- debe mantenerse simple y confiable, porque es el inicio del flujo.

**Recomendación:** **mantener**

Es parte del flujo de entrada y debe seguir siendo visible.

### Configuración

**Ruta:** `/configuracion`

**Nombre visible:** Configuración

**Propósito actual aparente:** ayuda y limitaciones.

**Secciones principales:**

- fuente de verdad;
- monedas;
- limitaciones conocidas.

**Qué información aporta realmente:**

- ayuda de sistema;
- advertencias de alcance;
- aclaraciones funcionales.

**Qué duplica con otras pestañas:**

- puede duplicar ayudas cortas ya visibles en otras páginas;
- parte del contenido es más de documentación que de configuración.

**Qué cosas parecen sobrar:**

- el nombre “Configuración” no refleja del todo que es también ayuda/documentación.

**Qué podría moverse a otra pestaña:**

- podría llamarse “Ayuda” o “Ayuda y configuración”;
- algunos textos podrían pasar a un centro de ayuda más liviano.

**Problemas de UX/apariencia detectados:**

- el contenido es útil, pero el título puede inducir a error;
- el usuario puede esperar controles y encontrarse con documentación.

**Recomendación:** **renombrar / mejorar**

No parece una pantalla para ajustes reales; es más bien ayuda y limitaciones.

## 4. Duplicaciones detectadas

### 4.1 Benchmark mínimo

Se repite en:

- Resumen;
- Posiciones;
- Detalle de posición;
- Histórico;
- Decisiones.

Riesgo:

- el usuario no sabe cuál es la referencia “oficial” para mirar el vs mínimo;
- se mezclan estado actual, detalle por especie y serie histórica.

### 4.2 Alertas

Se repite en:

- Resumen;
- Alertas;
- Decisiones.

Riesgo:

- Resumen pierde foco;
- Decisiones duplica una vista que ya existe.

### 4.3 Concentración / distribución

Se repite en:

- Resumen;
- Distribución;
- Concentración.

Riesgo:

- dos o tres pantallas muestran lecturas muy parecidas con distinto nombre.

### 4.4 Salud de datos / auditoría

Se repite en:

- Resumen;
- Datos a revisar;
- Importación.

Riesgo:

- el usuario no distingue qué es estado general y qué es diagnóstico técnico.

### 4.5 Estrategia / próximos hitos / objetivos

Se repite en:

- Resumen;
- Estrategia;
- Decisiones.

Riesgo:

- el usuario ve la planificación en varios lugares con distintos niveles de detalle.

### 4.6 Exportación / contexto para IA

Se repite en:

- Decisiones;
- Datos GPT.

Riesgo:

- dos vías distintas para generar contexto pueden confundir al usuario.

## 5. Problemas generales de UX

1. El sidebar está plano y no sigue un flujo de uso.
2. Hay demasiadas pantallas de análisis de nivel similar.
3. `Resumen` funciona como “todo junto”, no como portada ejecutiva.
4. Varios nombres son técnicos o ambiguos para un usuario no experto.
5. Hay pantallas que parecen herramientas internas, pero están al mismo nivel que las pantallas de operación diaria.
6. La deuda de texto con tildes rotas en varios templates afecta la percepción de calidad.
7. Algunas pantallas son demasiado densas en contenido y requieren demasiadas decisiones a la vez.

## 6. Propuesta de nueva navegación

### Propuesta principal

#### Principal

- Resumen
- Posiciones
- Decisiones

#### Análisis

- Distribución
- Concentración
- Histórico
- Alertas

#### Herramientas

- Datos GPT
- Importación
- Datos a revisar

#### Sistema

- Configuración

### Justificación

- `Principal` agrupa la navegación semanal de uso más frecuente.
- `Análisis` reúne pantallas de lectura profunda, no operativas.
- `Herramientas` reúne pantallas de soporte, exportación y mantenimiento.
- `Sistema` separa ayuda/configuración del resto.

### Ajustes recomendados

- `Estrategia` debería salir del menú principal o quedar como subpágina dentro de Decisiones hasta tener contenido real.
- `Distribución` y `Concentración` deberían evaluarse como pantallas hermanas o como subpestañas de una sola sección de Análisis.
- `Datos GPT` debe quedar claramente como herramienta secundaria.
- `Datos a revisar` y `Importación` deben vivir en Herramientas.

## 7. Prioridad de refactors

| Prioridad | Cambio | Impacto | Riesgo | Motivo |
| --- | --- | --- | --- | --- |
| 1 | Reordenar sidebar por grupos de uso | Alto | Bajo | Mejora navegación sin tocar lógica |
| 2 | Limpiar `Resumen` para que sea más ejecutivo | Alto | Medio | Reduce duplicación y sobrecarga visual |
| 3 | Simplificar `Posiciones` y el detalle de especie | Alto | Medio | Pantallas centrales, con demasiado contenido duplicado |
| 4 | Reducir duplicación entre Alertas, Concentración y Distribución | Medio | Medio | Evita pantallas hermanas con solapamiento |
| 5 | Mover `Estrategia` a un lugar secundario o fusionarlo | Medio | Bajo | Hoy aporta poco y distrae |
| 6 | Renombrar `Configuración` a `Ayuda y configuración` | Medio | Bajo | Alinea nombre con contenido real |
| 7 | Unificar herramientas de exportación y diagnóstico | Medio | Medio | Evita duplicar flujos entre Decisiones y Datos GPT |
| 8 | Limpiar textos con acentos rotos | Medio | Bajo | Mejora percepción de calidad general |

## 8. Plan de trabajo recomendado por etapas

### Etapa 1

- Reordenar sidebar y agrupar por intención.
- Ajustar nombres visibles si hace falta.
- No tocar cálculos ni pantallas internas.

### Etapa 2

- Reducir `Resumen` a KPIs, conclusiones cortas, benchmark resumido y acciones semanales.
- Mover enlaces y ayudas secundarias fuera del bloque principal.

### Etapa 3

- Limpiar `Posiciones` y `Detalle de posición`.
- Separar mejor resumen operativo, histórico y análisis profundo.

### Etapa 4

- Revisar `Alertas`, `Concentración` y `Distribución` para reducir solapamientos.
- Definir cuál queda como pantalla primaria y cuáles como vistas secundarias.

### Etapa 5

- Reubicar `Datos GPT`, `Datos a revisar`, `Importación` y `Configuración` en un grupo de herramientas/sistema.
- Mantenerlos visibles, pero fuera del flujo principal.

### Etapa 6

- Limpiar textos con codificación rota.
- Revisar microcopys para consistencia terminológica.

## Conclusión

La app está bien resuelta a nivel funcional, pero su navegación todavía refleja la historia técnica de las pantallas, no el flujo real de uso del portafolio. La mejora más rentable es organizar la experiencia en tres capas:

1. operación diaria;
2. análisis profundo;
3. mantenimiento/herramientas.

Eso va a reducir duplicaciones, aclarar el menú y hacer que `Resumen` vuelva a ser una portada ejecutiva en vez de una página que concentra todo.
