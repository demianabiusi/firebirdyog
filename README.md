# FirebirdYog 🔥

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-blue.svg)]()
[![Firebird](https://img.shields.io/badge/Firebird%20SQL-2.5%20%7C%203.0%20%7C%204.0%20%7C%205.0-red.svg)](https://firebirdsql.org/)

**FirebirdYog** es un cliente de base de datos moderno, ligero y elegante para **Firebird SQL**.

Inspirado en la agilidad y practicidad de herramientas clásicas como **SQLyog**, y nacido para ofrecer una alternativa moderna frente a interfaces añejas como **FlameRobin** o entornos excesivamente pesados como **DBeaver**.

---

## 🎯 ¿Por qué FirebirdYog?

En el ecosistema de Firebird SQL (ampliamente utilizado en sistemas ERP, facturación, puntos de venta y software de gestión), los desarrolladores y DBAs suelen enfrentarse al mismo dilema:
- **FlameRobin:** Interfaz obsoleta, sin autocompletado inteligente y con edición incómoda.
- **DBeaver:** Excelente pero excesivamente pesado (Java/Eclipse), consume cientos de MBs de memoria y tarda en abrir para consultas rápidas del día a día.
- **IBExpert:** Potente pero propietario, costoso en su versión completa y anclado a interfaces antiguas.

**FirebirdYog** combina lo mejor de ambos mundos: la ligereza de una aplicación portable, la potencia del editor de código de **VS Code (Monaco Editor)** y una experiencia de usuario diseñada para trabajar con velocidad y comodidad.

---

## ✨ Características Principales

### 🧠 Editor SQL con IntelliSense Contextual (Monaco Editor)
- **Autocompletado inteligente de campos:** Escribe `CLIENTES.` y se desplegará al instante la lista de columnas de esa tabla.
- **Soporte de Alias:** Reconoce alias en sentencias `FROM` y `JOIN` (por ejemplo `FROM CLIENTES c WHERE c.` desplegará las columnas de `CLIENTES`).
- **Palabras clave y funciones de Firebird:** Resaltado y sugerencias para `ROWS`, `FIRST`, `SKIP`, `GEN_ID`, `LIST`, `COALESCE`, `IIF`, tablas de sistema `RDB$...`, tipos de datos y más.
- **Atajos de teclado configurables:** 
  - Ejecutar consulta con `F9` o `Ctrl + Enter`.
  - Opción de **intercambiar F9 / F5** (estilo SQLyog) para alternar entre ejecutar consulta y refrescar objetos.
- **Múltiples pestañas:** Crea, renombra y organiza tantas solapas de consulta como necesites.

### 🗂️ Explorador de Objetos Completo
- **Árbol jerárquico:**
  - 📋 **Tablas:** Visualización de columnas, claves primarias, índices, triggers y generador de DDL.
  - 👁️ **Vistas:** Consulta rápida y definición DDL.
  - ⚙️ **Stored Procedures Inteligentes:** Detección automática de procedimientos ejecutables (`EXECUTE PROCEDURE`) vs seleccionables (`SELECT * FROM SP(...)`) inspeccionando los parámetros de entrada y salida requeridos.
  - ⚡ **Triggers:** Inspección de estado (activo/inactivo) y tabla asociada.
  - 🔢 **Generadores / Secuencias:** Con consulta directa de valores actuales (`GEN_ID`).
  - 🏷️ **Dominios** y ⚠️ **Excepciones**.
- **Filtro de búsqueda instantáneo:** Encuentra cualquier tabla, procedimiento o campo escribiendo en el buscador del árbol.

### 📊 Grilla de Resultados de Alto Rendimiento
- **Renderizado ultra-rápido:** Diseñado para visualizar miles de registros sin congelar la interfaz.
- **Filtro rápido:** Búsqueda en tiempo real sobre los datos ya cargados.
- **Copiado con 1 clic:** Haz clic sobre cualquier celda para copiar su valor al portapapeles.
- **Visor BLOB / Textos Largos:** Doble clic en una celda para abrir el visor dedicado para textos extensos o JSON.
- **Exportación directa:** Exporta los resultados seleccionados o completos a **CSV**, **JSON** o sentencias **SQL INSERT**.

### 💾 Persistencia Total del Entorno
- **Memoria por Conexión:** Cada base de datos recuerda sus propias pestañas abiertas, sus consultas escritas, el historial y la configuración de registros a mostrar (`maxRows`).
- **Estado de la Ventana:** Recuerda tamaño, posición en pantalla y si la ventana estaba maximizada.
- **Auto-reconexión al iniciar:** Al abrir la aplicación, reconecta automáticamente a la última base de datos usada para que puedas continuar trabajando de inmediato (configurable con opción de desactivar).

### 🌐 Conectividad y Charsets
- Compatible con **Firebird 2.5, 3.0, 4.0 y 5.0**.
- Soporte completo de codificaciones: `UTF8`, `ISO8859_1`, `WIN1252`, `LATIN1`, `NONE`, etc.
- Prueba de conexión con medición de latencia (ping en milisegundos).

---

## 📥 Descarga (Portátil para Windows)

No necesitas instalar Node.js ni compilar nada para usar FirebirdYog:

1. Ve a la sección de **[Releases](https://github.com/demianabiusi/firebirdyog/releases)**.
2. Descarga el archivo ejecutable portable `FirebirdYog-Portable.exe`.
3. Haz doble clic y ¡listo! No requiere instalación.

---

## 🛠️ Desarrollo y Compilación

Si deseas clonar el proyecto, ejecutarlo en desarrollo o compilarlo tú mismo:

### Requisitos previos
- [Node.js](https://nodejs.org/) v18 o superior
- [npm](https://www.npmjs.com/) v9 o superior

### Clonar y preparar dependencias
```bash
git clone https://github.com/demianabiusi/firebirdyog.git
cd firebirdyog
npm install
```

### Ejecutar en modo desarrollo
```bash
npm run dev
```

### Compilar binarios de producción
```bash
# Compilar frontend y proceso de Electron
npm run build

# Generar el ejecutable portable para Windows (.exe)
npm run package:win

# Generar AppImage para Linux
npm run package:linux
```
Los ejecutables generados se encontrarán en la carpeta `release/`.

---

## 🤝 Contribuciones

¡Las contribuciones, ideas, reportes de bugs y solicitudes de funcionalidades son bienvenidas!

1. Haz un Fork del proyecto.
2. Crea tu rama para la funcionalidad (`git checkout -b feature/nueva-funcionalidad`).
3. Haz commit de tus cambios (`git commit -m 'feat: agrega nueva funcionalidad'`).
4. Haz push a tu rama (`git push origin feature/nueva-funcionalidad`).
5. Abre un **Pull Request**.

---

## 📄 Licencia

Este proyecto está distribuido bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.
