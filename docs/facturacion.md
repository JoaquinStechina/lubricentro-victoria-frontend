# Facturación en la UI

Interfaz de la facturación electrónica de ARCA. La lógica fiscal (clase A o B, IVA, numeración, CAE) vive **toda en el backend**: ver `docs/facturacion-arca.md` del repo del backend. Acá solo se arma el pedido, se muestran los resultados y se evita facturar dos veces.

## Flujo

1. **Datos fiscales** (`/facturacion/config`): razón social, nombre de fantasía (opcional), domicilio, punto de venta, IIBB e inicio de actividades. El CUIT y el certificado se configuran en el servidor, no acá.
2. **Clientes** (`/clientes`): documento, nombre y condición de IVA. La condición decide si la factura sale A o B. Sin cliente, la venta es a Consumidor Final.
3. **Nueva venta** (`/ventas/nueva`): cliente, ítems (a mano o desde el catálogo con `ProductoCatalogoPicker`) y si los precios incluyen IVA. Los totales los calcula `POST /api/ventas/previsualizar` (`usePrevisualizacion`). El formulario no hace cuentas.
4. **Facturar:** desde la venta recién creada o desde el listado `/ventas`, con `useEmitirFactura`.
5. **Comprobante** (`/facturacion/[id]`): detalle, PDF, observaciones de ARCA, notas de crédito y débito, y reconciliación.

## Banner de estado (`EstadoArcaBanner`)

- **Aviso de ambiente.** Muestra si ARCA no está configurada y en qué ambiente se trabaja. En homologación avisa que los comprobantes no tienen validez fiscal.
- **Botones.** Las pantallas lo usan para deshabilitar «Facturar» cuando no se puede emitir.

## Reglas de la emisión (`useEmitirFactura`)

- **Idempotencia:**
  - cada intención de facturar una venta lleva una `claveIdempotencia` (`nuevaClave()`);
  - la clave se **reutiliza** mientras no haya respuesta con comprobante (red caída, timeout, 5xx, doble clic), así el backend devuelve el mismo comprobante en vez de emitir otro;
  - cuando llega un comprobante, en cualquier estado, la clave se descarta, y el próximo intento (por ejemplo, después de un rechazo) usa una nueva.
- **Doble clic.** Un `ref` (`enVuelo`) bloquea un segundo envío en el mismo tick.
- **Cómo se clasifica el resultado:** por el `estado` del comprobante, no por el status HTTP. El backend responde `201` también con comprobantes rechazados o con error.
  - **`autorizado`:** navega al comprobante.
  - **`pendiente`:** ARCA no confirmó, porque el backend respondió `202` o porque el comprobante quedó `pendiente`. Se ofrece reconciliar.
  - **`fallido`:** el comprobante quedó rechazado o en error. Se muestra el motivo.
  - **`error`:** la petición falló y no hay comprobante.

## Notas de crédito y débito (`NotaDialog`)

- **Anulación total.** Se manda **sin** `items`.
- **Nota parcial.** Los importes salen de la previsualización del backend.
- **Clave de idempotencia.** Se guarda junto con una huella del pedido (naturaleza más ítems) y sobrevive al cierre del diálogo.
- **Fallo incierto.** Tras un fallo incierto (sin respuesta o 5xx), el formulario **se congela**: solo se puede reintentar con la misma clave o cerrar. Editarlo crearía una clave nueva y podría duplicar la nota.
- **Error `503`.** Significa que ARCA no está configurada. Es un fracaso definitivo, no una duda: el backend responde antes de crear nada.

## Reconciliar

- **Cuándo aparece.** Un comprobante `pendiente` muestra «Reconciliar» (`POST .../reconciliar`). Mientras siga pendiente, la numeración de ese tipo queda bloqueada en el backend.
- **Error `409`.** Significa que el comprobante ya no está pendiente: la pantalla refresca la fila.
