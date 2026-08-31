# FirebirdYog 🔥

Un cliente de base de datos moderno, rápido e intuitivo para **Firebird SQL** (versiones 2.5, 3.0, 4.0 y 5.0) desarrollado con **Electron.js**, **React**, **TypeScript** y **Tailwind CSS**.

---

## 🚀 Características Principales

### 1. 🗂️ Explorador de Objetos (Panel Izquierdo)
- **Árbol de Objetos Firebird:**
  - 📋 **Tablas (Tables):** Listado completo con acciones rápidas (`SELECT *`, inspeccionar estructura, DDL).
  - 👁️ **Vistas (Views):** Consulta rápida y listado.
  - ⚙️ **Procedimientos Almacenados (Stored Procedures):** Con conteo de parámetros de entrada/salida y generador de plantillas `EXECUTE PROCEDURE` / `SELECT`.
  - ⚡ **Disparadores (Triggers):** Estado activo/inactivo y tabla asociada.
  - 🔢 **Generadores / Secuencias (Generators):** Con consulta de valor actual `GEN_ID(..., 0)`.
  - 🏷️ **Dominios (Domains):** Dominios definidos por el usuario.
  - ⚠️ **Excepciones (Exceptions):** Mensajes de error personalizados del motor.
- **Filtro en tiempo real:** Búsqueda instantánea de cualquier objeto en la base de datos.
- **Modal de Detalle de Tabla:** Inspección visual de columnas, tipos, llaves primarias, valores por defecto, índices, triggers y DDL generado.

### 2. 📝 Editor SQL Avanzado (Panel Derecho Superior)
- Basado en **Monaco Editor** (el motor de VS Code).
- **Pestañas múltiples:** Abre y administra múltiples consultas simultáneamente con renombrado y cierre.
- **Atajos de Teclado:**
  - `F9` o `Ctrl + Enter`: Ejecutar consulta completa o texto seleccionado.
  - `Ctrl + N`: Abrir nueva pestaña de consulta.
- **Autocompletado SQL inteligente:** Palabras clave de Firebird (`ROWS`, `FIRST`, `SKIP`, `GEN_ID`, `LIST`, `COALESCE`, tablas de sistema `RDB$...`, etc.).
- **Barra de herramientas:**
  - ⚡ Ejecutar consulta / ⏯️ Ejecutar selección.
  - 📂 Abrir archivo `.sql` / 💾 Guardar como `.sql`.
  - ✨ Formatear palabras clave a mayúsculas.
  - 🧹 Limpiar editor.
  - Selector de límite de filas (`ROWS 100`, `500`, `1000`, etc.).

### 3. 📊 Grilla de Resultados y Salida (Panel Derecho Inferior)
- **Visualización de Datos:**
  - Tabla de alto rendimiento con numeración de filas y ordenamiento por columnas.
  - 🔍 **Buscador interno:** Filtra filas y resultados al instante.
  - 📋 **Copiado rápido:** Haz clic en cualquier celda para copiar su valor.
  - 🔍 **Visualizador de Celda / BLOB:** Doble clic para inspeccionar textos largos, JSON o datos binarios.
  - 📥 **Exportación:** Exporta resultados con un clic a **CSV**, **JSON** o sentencias **SQL INSERT**.
- **Panel de Mensajes / Consola:** Registro de tiempo de ejecución (ms), filas afectadas y detalle completo de errores de Firebird.
- **Historial de Consultas:** Registro de las últimas 50 consultas ejecutadas con estado y duración.

### 4. 🔌 Gestor de Conexiones
- Perfiles guardados en el almacenamiento local del sistema.
- Configuración de:
  - Host / IP y Puerto (por defecto `3050`).
  - Ruta de base de datos (`.fdb`, `.gdb`) con selector de archivo integrado o Alias.
  - Usuario (`SYSDBA`), Contraseña, Rol.
  - Charsets soportados (`UTF8`, `ISO8859_1`, `WIN1252`, `NONE`, etc.).
  - Dialecto SQL (Dialect 3 / Dialect 1).
- Botón **"Probar Conexión"** con medición de latencia (ping en ms).

---

## 🛠️ Instalación y Ejecución

### Requisitos
- **Node.js** v18 o superior.
- **npm** v9 o superior.

### Modo Desarrollo (Live Reload)
```bash
npm run dev
```

### Compilar y Ejecutar en Producción
```bash
npm run build
npm start
```

---

## 📂 Estructura del Proyecto

```
firebirdyog/
├── electron/
│   ├── main.ts              # Proceso principal de Electron y canales IPC
│   ├── preload.ts           # Script de precarga seguro (ContextBridge)
│   ├── firebird-service.ts  # Servicio de conexión y ejecución Firebird nativo
│   └── storage-service.ts   # Persistencia de perfiles de conexión en disco
├── src/
│   ├── components/
│   │   ├── Editor/          # Monaco SQL Editor y Barra de Pestañas
│   │   ├── Grid/            # Grilla de resultados, mensajes e historial
│   │   ├── Modals/          # Gestor de conexiones y estructura DDL
│   │   ├── Sidebar/         # Árbol jerárquico de objetos de la BD
│   │   └── Navbar.tsx       # Barra superior de estado
│   ├── types/               # Definiciones de tipos TypeScript
│   ├── utils/               # Utilidades de exportación (CSV, JSON, SQL)
│   ├── App.tsx              # Componente principal con Layout Split
│   ├── index.css            # Estilos y scrollbars con Tailwind CSS
│   └── main.tsx             # Punto de entrada React
├── package.json
├── tsconfig.json
└── vite.config.ts
```
