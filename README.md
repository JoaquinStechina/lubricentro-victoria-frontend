# Lubricentro Victoria — Catálogo de proveedores

Prototipo web para visualizar y filtrar el catálogo centralizado de listas de precios y ofertas de los proveedores del lubricentro (Bosch, Mobil, Tecfil, Wega, O'Cuatro, entre otros), ya normalizados a partir de sus archivos originales.

## Demo

![Búsqueda en todas las columnas, sin distinguir acentos](docs/demo-busqueda.svg)

Al tipear en el buscador se filtran **todas** las columnas de la tabla (no solo SKU/Descripción), la comparación **ignora acentos** (`bateria` encuentra tanto `BATERIA` como `BATERÍA`) y las coincidencias se resaltan en toda la fila.

## Funcionalidades

- **Catálogo** (`/`, pestaña "Catálogo"): filtros por Proveedor, Marca, Sección (combobox con búsqueda, +490 valores), Vigencia, IVA y rango de precio neto.
- **Ofertas** (pestaña "Ofertas"): filtros por Marca, Fecha de oferta, rango de descuento y rango de precio unitario.
- Todos los filtros son **combinables** entre sí con lógica AND (cada uno reduce más el resultado sobre el anterior), incluyendo el buscador de texto libre.
- El buscador compara sobre **todos los campos** de cada fila (no solo SKU/descripción) y es **insensible a acentos**, sin modificar el texto original que se muestra en pantalla.
- Las coincidencias se **resaltan** en cualquier columna donde aparezcan.
- Filas con datos del proveedor que no entran en el schema canónico se pueden expandir para ver el `raw_data` original.
- Tema claro/oscuro automático según preferencia del sistema operativo.

## Stack

- [Next.js](https://nextjs.org) (App Router, Turbopack) + React + TypeScript
- Tailwind CSS v4
- [shadcn/ui](https://ui.shadcn.com) sobre [Base UI](https://base-ui.com) (`style: base-nova`)

## Getting Started

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Datos

Los datos parseados viven en `data/productos_todos.json` y `data/ofertas.json`, leídos por `app/lib/productos.ts` y `app/lib/ofertas.ts` y expuestos vía `app/api/productos` y `app/api/ofertas`.
