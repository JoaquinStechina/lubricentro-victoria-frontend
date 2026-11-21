# Arquitectura

## Cómo se habla con la API

- **Sin proxy.** Todas las páginas son client components y hacen `fetch` directo al backend desde el navegador. No hay proxy por Route Handlers.
- **`app/lib/api.ts`** es el cliente fino:
  - `API_URL`: `NEXT_PUBLIC_API_URL`, o `http://localhost:4000` por defecto;
  - `apiFetch<T>(path, init)`: `fetch` + `res.json()` que lanza si la respuesta no es ok;
  - `apiJsonInit(body, method)`: arma un `RequestInit` con JSON;
  - `apiDownload(path, filename)`: descarga los exports CSV o XLSX;
  - `imagenSrc(path)`: arma la URL completa de una imagen a partir de la ruta relativa que devuelve el backend.
- **`app/lib/facturacion.ts`:** tipos, formateadores y `fetchFacturacion`, más `ErrorApi`, que expone `error` y `detalles` del backend.
- **Tipos por recurso.** `productos.ts`, `ofertas.ts`, `stock.ts`, `cargas.ts` y `autoDescargas.ts` reflejan el JSON real del backend, con las mismas listas blancas de campos editables. Son **copias a mano**: no hay un paquete compartido.

## Hooks compartidos (`app/lib/`)

| Hook | Para qué |
|---|---|
| `useTablaRecurso` | Estado de tabla de Catálogo, Ofertas y Stock: búsqueda con debounce, filtros por columna, orden ciclado, paginación, selección y papelera. Las columnas y acciones de cada recurso **no** viven acá. |
| `useColumnPrefs` | Orden y ancho de columnas persistidos en `localStorage` (`lv:columnas:<vista>`). |
| `useEstadoArca` | Una sola petición compartida a `GET /api/facturacion/estado` para el banner y la pantalla que lo usa. |
| `usePrevisualizacion` | Totales de una venta pedidos a `POST /api/ventas/previsualizar`. Descarta las respuestas viejas comparando la clave de la consulta. |
| `useEmitirFactura` | Emite y clasifica el resultado. Ver [facturacion.md](facturacion.md). |

Otros helpers:

- **`ventasForm.ts`:** estado del formulario de venta. Los números se guardan como texto crudo y se convierten al armar el pedido.
- **`applyMappingPreview*.ts`:** espejo del mapeo de columnas del backend, para la vista previa de una carga.
- **`text.ts`:** normalización para buscar sin acentos y resaltar.

## Componentes

- **Por módulo:** `app/components/<módulo>/`. Cada módulo tiene su vista principal (`*View.tsx`) y sus diálogos (`Nuevo*`, `Editar*`, `BulkEditar*`, `Eliminar*`, `Historial*`).
- **Compartidos de tabla:**
  - `ColumnFilterHeader.tsx`: todos los modos de filtro (texto, select, combobox, rango y fecha) por props opcionales;
  - `SortableResizableHead.tsx`: columnas arrastrables y redimensionables con `@dnd-kit`;
  - `ColumnVisibilityMenu.tsx`;
  - `TablePaginationBar.tsx`;
  - `HighlightText.tsx`;
  - `ExportarButton.tsx`.
- **`HistorialChart.tsx`:** gráfico de línea en SVG propio, sin librería de charts.
- **`components/ui/`:** componentes de shadcn sobre Base UI. Íconos con `lucide-react`.
- **Tema claro/oscuro:** `ThemeProvider.tsx` y `ThemeToggle.tsx`. La preferencia se guarda en `localStorage`.

## Convenciones

- **Errores.** Se muestran con el mensaje que manda el backend (`error`), que ya viene en español.
- **Borrado.** Siempre es lógico (papelera con «Ver eliminados» y «Restaurar»).
- **Dinero e IVA.** Los formatea el frontend, pero los calcula el backend.
- **Fechas.** Inputs nativos `type="date"` / `type="time"`, porque el backend usa `YYYY-MM-DD` / `HH:MM`.
