# Lubricentro Victoria — Frontend

Interfaz web del sistema del lubricentro. Cubre:

- el catálogo y las ofertas de los proveedores;
- la carga de listas de precios con revisión humana;
- el stock;
- los clientes y las ventas;
- la facturación electrónica de ARCA.

Habla con la API del repo hermano `lubricentro-victoria-backend`.

**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4 y shadcn/ui sobre Base UI (estilo `base-nova`).

## Inicio rápido

```bash
npm install
npm run dev          # http://localhost:3000; necesita el backend en http://localhost:4000
```

El sistema pide una clave: la del `CLAVE_ACCESO_HASH` del backend. Para desarrollar sin clave, poné `ACCESO_DESACTIVADO=1` en el `.env` del backend.

Para usar otra URL de la API, definí `NEXT_PUBLIC_API_URL` en `.env.local`. Se hornea al compilar.

## Comandos

| Comando | Para qué |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npx tsc --noEmit` | Chequeo de tipos (lo corre la CI). |
| `npx eslint .` | Lint (lo corre la CI). |
| `npm run build` / `npm start` | Build `standalone` (lo corre la CI) y servidor de producción. |

## Estructura

```
app/
  page.tsx            Catálogo y Ofertas (pestañas)
  cargas/             Subir archivos, revisión (/cargas/[id]), gestión y auto-descargas
  stock/              Artículos, movimientos y reposición (pestañas)
  ventas/             Listado y nueva venta (desde acá se factura)
  clientes/           Receptores de facturas
  facturacion/        Comprobantes, detalle (/facturacion/[id]) y datos fiscales (/facturacion/config)
  components/         Vistas y diálogos por módulo: catalogo/, ofertas/, cargas/, stock/, facturacion/, autoDescargas/
  lib/                Cliente HTTP, tipos de la API y hooks compartidos
components/ui/        Componentes shadcn/Base UI
docs/                 Documentación por tema
data/                 JSON del prototipo original: ya no los usa nada
```

## Reglas para agentes

1. **Esta versión de Next tiene cambios incompatibles con lo que conocés.** Antes de usar una API de Next, leé la guía en `node_modules/next/dist/docs/` (ver `AGENTS.md`).
2. **Todo se pide desde el navegador, con la sesión.** Todas las páginas son client components (`"use client"`) y llaman a la API desde el navegador. **Todo pedido pasa por `fetchApi` (`app/lib/sesion.ts`)**, directamente o a través de `apiFetch`, `apiDownload` o `fetchFacturacion`: manda la cookie de sesión y, ante un `401`, lleva a `/entrar`. No uses `fetch` suelto contra la API. No hay Route Handlers, server actions ni fetch del lado del servidor: la cookie la tiene el navegador. nginx no tiene basic auth activo; ver [docs/acceso.md](docs/acceso.md).
3. **`NEXT_PUBLIC_API_URL` se hornea en el build.** Cambiarla exige recompilar.
4. **Los tipos de la API son copias a mano** de lo que devuelve el backend (`app/lib/*.ts`), porque no hay un paquete compartido. Si cambia una respuesta del backend, actualizá el tipo acá.
5. **Facturación:**
   - el frontend no calcula importes: usa `POST /api/ventas/previsualizar`;
   - el éxito de una emisión se decide por el `estado` del comprobante, no por el status HTTP.
6. **Un push a `master` despliega a producción.** Trabajá en una rama y no pushees a `master` sin el OK del dueño, nunca mientras el cliente está usando el sistema.
7. **UI en español rioplatense (voseo), con tema claro y oscuro.**
8. **Lint con reglas de `react-hooks`:** nada de `setState` sincrónico dentro de `useEffect`.

## Documentación

| Doc | Contenido |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Cómo se habla con la API, hooks compartidos, componentes y estilos. |
| [docs/acceso.md](docs/acceso.md) | Pantalla «Entrar», sesión, botón «Salir» y qué pasa ante un 401. |
| [docs/pantallas.md](docs/pantallas.md) | Qué hace cada ruta y qué endpoints usa. |
| [docs/facturacion.md](docs/facturacion.md) | Flujo de ventas, emisión, notas y reconciliación en la UI. |
| [docs/despliegue.md](docs/despliegue.md) | Build, CI/CD y variables. |
