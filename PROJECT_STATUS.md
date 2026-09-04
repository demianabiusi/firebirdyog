# Estado del Proyecto: FirebirdYog 🔥

*Documento de traspaso y contexto para continuar el desarrollo.*
*Fecha de última actualización: 04/09/2026*

---

## 1. 📌 Resumen General
**FirebirdYog** es un cliente de escritorio liviano, moderno y ágil para **Firebird SQL (2.5 a 5.0)**, desarrollado con **Electron**, **React 19**, **TypeScript**, **Tailwind CSS** y **Monaco Editor**. Nació para resolver las deficiencias y la antigüedad visual de FlameRobin y la pesadez de DBeaver, tomando como inspiración la experiencia y flujo de trabajo de SQLyog.

- **Repositorio:** [github.com/demianabiusi/firebirdyog](https://github.com/demianabiusi/firebirdyog)
- **Rama principal:** `main` (todo el código actual está compilado y pusheado).

---

## 2. 🚀 Funcionalidades Completadas y Recientes

### A. Persistencia y Entorno de Trabajo
- **Espacio de trabajo por conexión:** Cada base de datos recuerda sus propias solapas abiertas, consultas escritas, historial y límite de filas (`maxRows`), guardado en `localStorage`.
- **Persistencia de la ventana:** En `electron/main.ts` se guarda el tamaño (`width`, `height`), posición (`x`, `y`) y si estaba maximizada (`isMaximized`) en `window-state.json`. Restaura sin saltos visuales y valida monitores desconectados.
- **Auto-reconexión al iniciar:** Recuerda la última conexión activa y al abrir la app se conecta automáticamente restaurando el espacio de trabajo. Se puede activar/desactivar desde un checkbox en el `ConnectionModal`.

### B. Editor SQL Inteligente (Monaco Editor)
- **Autocompletado de columnas por tabla:** Escribir `TABLA.` (ej. `CLIENTES.`) despliega inmediatamente los campos de esa tabla.
- **Detección de Alias SQL:** Si la consulta usa `FROM CLIENTES c` o `JOIN CLIENTES AS c`, escribir `c.` resuelve el alias y ofrece las columnas de `CLIENTES`.
- **Autocompletado general:** Sugiere tablas, vistas, procedimientos, funciones nativas y palabras clave de Firebird (`ROWS`, `FIRST`, `SKIP`, etc.).
- **Atajos y Swap F9/F5:** Tecla F9 para ejecutar (o Ctrl+Enter). Botón para intercambiar F9 y F5 (para usuarios habituados a SQLyog donde F5 es ejecutar y F9 es refrescar).
- **Nueva solapa limpia:** Al abrir una solapa nueva de query, ahora inicia completamente vacía.

### C. Árbol de Objetos y Llamada de Stored Procedures
- **Detección de tipo de Stored Procedure:**
  - Procedimientos seleccionables (`outputs > 0`): genera `SELECT * FROM SP_NAME(P1, P2);`.
  - Procedimientos ejecutables (`outputs === 0`): genera `EXECUTE PROCEDURE SP_NAME (P1, P2);`.
  - Inspecciona `RDB$PROCEDURE_PARAMETERS` (`RDB$PARAMETER_TYPE = 0`) para colocar los parámetros de entrada reales en la firma.
  - Si requiere parámetros de entrada, al hacer clic en "Ejecutar" o Play, carga la plantilla en el editor sin auto-ejecutar para que el usuario complete los valores.

### D. Conectividad y Formatos
- Solucionado el problema con el charset `ISO8859_1` en `node-firebird`.
- Grilla de resultados virtualizada con copiado al portapapeles, visor de celdas/BLOBs y exportación a CSV, JSON y SQL INSERT.
- Herramienta visual de Dump y Restauración de base de datos.

### E. Preparación para Publicación Open Source
- **Licencia:** MIT (archivo `LICENSE` a nombre de Demian Abiusi).
- **README.md:** Rediseñado completamente con propuesta de valor, capturas, guía de características y de compilación.
- **CI/CD con GitHub Actions:** Creado `.github/workflows/release.yml` para compilar automáticamente el `.exe` portable de Windows al crear un tag (ej: `v1.0.0`) o disparar el workflow manualmente.

---

## 3. ⚙️ Preferencias y Restricciones del Usuario
- **Compilaciones de Windows:** No generar el `.exe` con `npm run package:win` en cada cambio local menor (tarda mucho). Solo compilar y verificar con `npm run build` y pushear a Git. Las releases completas se delegan a GitHub Actions o se compilan solo cuando sea necesario un instalador.
- **Idioma de preferencia:** Español.

---

## 4. 🧭 Próximos Pasos Posibles
1. Publicar el primer Release `v1.0.0` en GitHub creando el tag o disparando la acción.
2. Agregar capturas de pantalla reales o GIF animado al `README.md`.
3. Compartir en comunidades de Firebird (FirebirdNews, grupos de Telegram/Reddit).
4. Nuevas mejoras según surjan (ej: visualizador de planes de ejecución `EXPLAIN PLAN`, edición en grilla directa, etc.).
