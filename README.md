# Lubricentro Victoria — Catálogo de proveedores

Prototipo web para visualizar y filtrar el catálogo centralizado de listas de precios y ofertas de los proveedores del lubricentro (Bosch, Mobil, Tecfil, Wega, O'Cuatro, entre otros), ya normalizados a partir de sus archivos originales.

## Demo

![Búsqueda en todas las columnas, sin distinguir acentos](docs/demo-busqueda.svg)

Al tipear en el buscador se filtran **todas** las columnas de la tabla (no solo SKU/Descripción), la comparación **ignora acentos** (`bateria` encuentra tanto `BATERIA` como `BATERÍA`) y las coincidencias se resaltan en toda la fila.

## Autenticación y roles

Toda la app requiere sesión iniciada — incluida la vista pública `/`. Hay
tres roles con jerarquía acumulativa:

- **Empleado**: solo ve `/` (catálogo y ofertas).
- **Administrador**: además, `/cargas`, `/cargas/:id` y `/cargas/gestion`
  (cargar y gestionar datos).
- **Sysadmin**: además, `/usuarios` (crear/editar cuentas de administrador y
  empleado).

`proxy.ts` (raíz del proyecto — en Next.js 16 reemplaza a `middleware.ts`,
deprecado) verifica en cada request la cookie de sesión (`session`, JWT
httpOnly emitido por el backend en `POST /api/auth/login`) y redirige a
`/login` si falta, o a `/` si el rol no alcanza para la ruta pedida. Es un
chequeo optimista (solo lee el JWT, sin ir a la base) — la autorización real
para cada acción la vuelve a validar el backend (ver
`../backend/README.md`, sección "Autenticación y roles"); no hay que
confiar solo en este gate del lado del cliente.

`app/lib/session.ts` (`getSession()`) hace la misma verificación del lado
del servidor para Server Components y Route Handlers — usado en
`app/layout.tsx` (que arma el `SessionProvider`/`useSession()` consumido
por `UserMenu` y por las páginas para mostrar/ocultar acciones según rol,
incluyendo la columna de selección y la barra Editar/Eliminar de
Catálogo/Ofertas, visibles solo para `ADMINISTRADOR`+).

El gate de rol del lado del cliente (ocultar botones) es solo UX: la
autorización real la vuelve a validar el backend en cada endpoint que
muta datos (`requireRole`, ver `../backend/README.md`) — por ejemplo, un
`EMPLEADO` que llame `PATCH /api/productos/:id` directo recibe 403 aunque
la UI nunca le muestre el botón.

Requiere `JWT_SECRET` en `.env.local` — **mismo valor** que
`JWT_SECRET` en `backend/.env`, porque ambos firman/verifican el mismo
token.

## Funcionalidades

- **Catálogo** (`/`, pestaña "Catálogo"): filtros por Proveedor, Marca, Sección (combobox con búsqueda, +490 valores), Vigencia, IVA y rango de precio neto.
- **Ofertas** (pestaña "Ofertas"): filtros por Marca, Fecha de oferta, rango de descuento y rango de precio unitario.
- Todos los filtros son **combinables** entre sí con lógica AND (cada uno reduce más el resultado sobre el anterior), incluyendo el buscador de texto libre.
- El buscador compara sobre **todos los campos** de cada fila (no solo SKU/descripción) y es **insensible a acentos**, sin modificar el texto original que se muestra en pantalla.
- Las coincidencias se **resaltan** en cualquier columna donde aparezcan.
- Filas con datos del proveedor que no entran en el schema canónico se pueden expandir para ver el `raw_data` original.
- Tema claro/oscuro automático según preferencia del sistema operativo.
- **Editar y eliminar filas** (`/`, ambas pestañas, solo `ADMINISTRADOR`+): cada fila tiene un
  checkbox de selección, más uno en el header para seleccionar todas las filas de la página
  actual (no todo el resultado filtrado). Con filas seleccionadas aparece una barra con:
  - **Editar**: con 1 fila seleccionada abre un formulario con todos sus campos editables
    (`EditarProductoDialog.tsx` / `EditarOfertaDialog.tsx`, `PATCH /api/productos|ofertas/:id`);
    con más de una, abre un diálogo de edición en lote que aplica un mismo valor a un único campo
    de una lista reducida de campos "seguros" (`BulkEditarProductoDialog.tsx` /
    `BulkEditarOfertaDialog.tsx`, `POST /api/productos|ofertas/editar-lote`) — no incluye campos
    identificadores como marca/SKU/descripción, para no corromper datos al aplicar en lote.
  - **Eliminar**: pide confirmación y hace un borrado **lógico** (`POST
    /api/productos|ofertas/eliminar`, marca `eliminado: true`) — la fila deja de aparecer en la
    UI pero nunca se borra físicamente de la base.

  Ver `../backend/README.md` para las listas blancas de campos editables y el detalle de cada
  endpoint.
- **Cargar archivo** (`/cargas`): habla en vivo con el backend (`../backend`, Express + Prisma).
  Subís un archivo (imagen, PDF o excel) de un proveedor, se procesa con IA, y antes de guardar
  nada se muestra una pantalla de revisión donde se puede corregir el mapeo de columnas y
  cualquier valor extraído a mano — ninguna carga se publica sin confirmación humana. Esa misma
  pantalla (`ReviewTable.tsx` / `ReviewTableOfertas.tsx`) marca con ⚠ las filas con advertencias
  (precio en cero, SKU/tramo duplicado, salto de precio anómalo, campos obligatorios faltantes en
  ofertas — ver `../backend/README.md`) calculadas por el backend al abrir la pantalla; son solo
  informativas, no bloquean la confirmación. Requiere el backend corriendo
  (`NEXT_PUBLIC_API_URL`, default `http://localhost:4000`, ver `.env.local`).
- **Catálogo y ofertas vigentes** (`/cargas/gestion`): pantalla mínima, también contra el backend
  real, para ver el precio actual por SKU (`ProductoPrecio.vigente`) y las ofertas activas, y
  cerrar/reactivar una oferta ("marcar agotada") cuando se acaba el stock — ver `../contexto.md`,
  sección "Vigencia de catálogo y ofertas".

## Stack

- [Next.js](https://nextjs.org) (App Router, Turbopack) + React + TypeScript
- Tailwind CSS v4
- [shadcn/ui](https://ui.shadcn.com) sobre [Base UI](https://base-ui.com) (`style: base-nova`)

## Getting Started

```bash
npm install
npm run dev
```

Necesita `.env.local` con `NEXT_PUBLIC_API_URL` y `JWT_SECRET` (ver
"Autenticación y roles"), y el backend corriendo con al menos un `SYSADMIN`
sembrado (`npm run seed:sysadmin` en `../backend`, ver su README).

Abrí [http://localhost:3000](http://localhost:3000) — redirige a `/login`.

## Datos

`/` (Catálogo/Ofertas), `/cargas` y `/cargas/gestion` leen todas del backend real (`../backend`,
Express + Prisma) vía `apiFetch` (`app/lib/api.ts`) — no hay ninguna vista que dependa de datos
locales al frontend. `app/lib/productos.ts` y `app/lib/ofertas.ts` solo exponen los tipos
(`Producto`/`Oferta`, con el mismo shape camelCase que devuelve la API) y las listas blancas de
campos editables, ya no cargan ni consultan JSON.

`data/productos_todos.json` y `data/ofertas.json` son un snapshot del prototipo original —
ya no los lee ningún código del proyecto, se pueden borrar sin impacto.
