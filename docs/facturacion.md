# Facturación en la UI

Interfaz de la facturación electrónica de ARCA. La lógica fiscal (clase A o B, IVA, numeración, CAE) vive **toda en el backend**: ver `docs/facturacion-arca.md` del repo del backend. Acá solo se arma el pedido, se muestran los resultados y se evita facturar dos veces.

## Flujo

1. **Datos fiscales** (`/facturacion/config`): razón social, nombre de fantasía (opcional), domicilio, punto de venta, IIBB e inicio de actividades. El CUIT y el certificado se configuran en el servidor, no acá.
2. **Clientes** (`/clientes`): documento, nombre y condición de IVA. La condición decide si la factura sale A o B. Sin cliente, la venta es a Consumidor Final.
3. **Nueva venta** (`/ventas/nueva`): cliente, ítems (a mano o desde el catálogo con `ProductoCatalogoPicker`) y si los precios incluyen IVA. Los totales los calcula `POST /api/ventas/previsualizar` (`usePrevisualizacion`). El formulario no hace cuentas.
4. **Facturar:** desde la venta recién creada o desde el listado `/ventas`, con `useEmitirFactura`.
5. **Comprobante** (`/facturacion/[id]`): detalle, QR para el cliente, PDF, observaciones de ARCA, notas de crédito y débito, y reconciliación. Después de facturar se llega acá.

## Ventas ya facturadas por fuera (`/ventas/ya-facturada`)

Para una venta que **ya se facturó por otro medio** (por ejemplo en Comprobantes en línea): queda en el historial con los datos de su factura y **nunca se informa a ARCA**, porque sería facturar dos veces. Se llega con «Registrar venta ya facturada» desde Comprobantes o Ventas.

- **Envío.** Manda `POST /api/ventas/externas` con tipo (A o B), punto de venta, número y fecha de la factura real, más cliente e ítems. No importa `useEmitirFactura` y no tiene «Facturar»: un solo botón, «Registrar venta».
- **Previsualización.** Solo muestra totales. Sus `errores` son reglas para emitir por ARCA y acá no se muestran. Si la clase que saldría para el cliente no coincide con el tipo elegido, avisa sin bloquear.
- **Doble envío.** Reintentar es seguro: la misma factura no se registra dos veces (`409` que dice en qué venta está).
- **Listado de Ventas.** Muestra «Facturada por fuera» (`estadoFactura: "facturada_fuera"`) y la referencia `Factura B 0001-00006001`, sin «Facturar» ni «Ver comprobantes». Eliminarla no anula la factura real.

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
- **Nota parcial.** Los importes salen de la previsualización del backend. Nunca repone stock.
- **«¿Reponer al stock?».** Solo en la anulación total: pide `GET .../stock` del original. Con descuento aplicado muestra los artículos que vuelven; con descuento pendiente avisa que todavía no se aplicó: si se repone, el stock queda como estaba; si no, el descuento pendiente se aplica igual más adelante y la mercadería cuenta como vendida. En ambos casos hay que elegir «Reponer al stock» o «No reponer» (sin opción por defecto) para habilitar «Emitir». Con stock `no` o `cancelado` no pregunta y manda `reponerStock: false`. Si la consulta falla, avisa y permite reintentar o emitir sin reponer (`reponerStock: false`): el stock nunca bloquea una anulación.
- **Clave de idempotencia.** Se guarda junto con una huella del pedido (naturaleza, ítems y `reponerStock`) y sobrevive al cierre del diálogo.
- **Fallo incierto.** Tras un fallo incierto (sin respuesta o 5xx), el formulario **se congela**: solo se puede reintentar con la misma clave o cerrar. Editarlo crearía una clave nueva y podría duplicar la nota.
- **Error `503`.** Significa que ARCA no está configurada. Es un fracaso definitivo, no una duda: el backend responde antes de crear nada.

## QR para el cliente (`QrClienteDialog`)

El cliente escanea un QR en la pantalla del mostrador y ve su comprobante (el PDF) en el celular, sin entrar al sistema.

- **Dónde está.** «Mostrar QR para el cliente» es el primer botón del detalle de un comprobante `autorizado`: después de facturar (o de emitir una nota) se llega ahí. En el listado de Comprobantes, cada fila autorizada tiene un botón «QR».
- **Qué pide.** Al abrir, `GET /api/facturacion/comprobantes/:id/enlace-publico` → `{ url, qrSvg }` (`obtenerEnlacePublico`). El backend crea el enlace la primera vez y después devuelve siempre el mismo. Un `503` (falta `URL_PUBLICA` en el servidor) o un `409` se muestran con «Reintentar».
- **Qué muestra:**
  - el QR grande, **negro sobre blanco también en modo oscuro**, con «Escaneá para ver tu factura» y el tipo y número del comprobante;
  - el SVG va como `data:` URI en un `<img>`, no inyectado en la página: no puede ejecutar nada;
  - «Pantalla completa»: el diálogo pasa a cubrir toda la ventana, blanco y solo con el QR, y además pide la pantalla completa del navegador (Fullscreen API). Si el navegador no la da, el QR igual ocupa toda la ventana. Esc o «Salir de pantalla completa» vuelven al diálogo normal (Esc no lo cierra);
  - el diálogo normal tiene alto acotado y scroll: en una pantalla de 768 px entra entero;
  - el enlace en un campo de solo lectura y «Copiar enlace».
- **Copiar sin HTTPS.** `navigator.clipboard` solo existe con HTTPS o en `localhost`. Mientras el sistema se use por `http://IP`, «Copiar enlace» selecciona el campo y usa `document.execCommand("copy")`; si eso también falla, deja el enlace seleccionado y pide Ctrl + C.
- **Cuidado.** Quien tiene el enlace ve esa factura: el campo lo avisa.

## Reconciliar

- **Cuándo aparece.** Un comprobante `pendiente` muestra «Reconciliar» (`POST .../reconciliar`). Mientras siga pendiente, la numeración de ese tipo queda bloqueada en el backend.
- **Error `409`.** Significa que el comprobante ya no está pendiente: la pantalla refresca la fila.

## Stock al facturar y al anular

- **Precio sugerido.** Al cargar un ítem de una venta oficial se sugiere el precio del catálogo («Precio sugerido del catálogo»).
- **«Agregar desde stock».** El editor de ítems busca artículos del stock y vincula el ítem al artículo. Las notas parciales no vinculan. Un ítem del catálogo se vincula solo si su código coincide con un único artículo; si esa búsqueda vuelve con el editor ya bloqueado (la venta se guardó o se está guardando), no se vincula.
- **«¿Descontar del stock?».** Al facturar, un diálogo muestra la vista previa (`GET /api/ventas/:id/stock`: qué se descuenta, cuánto quedaría y qué se omite y por qué) y manda `descontarStock` con «Facturar y descontar» o «Facturar sin descontar». Las ventas externas nunca mueven stock.
  - **Nueva venta** («Guardar y facturar» y «Facturar ahora») pide la vista previa antes: si no hay nada para descontar, factura directo con `descontarStock: false`, sin diálogo. El diálogo se abre solo si hay algo para descontar o si la consulta falla (avisa y ofrece «Reintentar» o «Facturar sin descontar»).
  - **El listado de Ventas** siempre abre el diálogo: sin nada para descontar, es la confirmación de «Facturar».
- **Sección «Stock» del comprobante** (facturas y NC; las notas de débito no la tienen). Estados de `GET .../stock`:
  - `aplicado`: «Stock descontado el …» (factura) o «Stock repuesto el …» (NC), con los movimientos. Si no hubo ninguno, lo dice («Sin movimientos: …»).
  - `no`: «No se descontó stock» o «No se repuso stock».
  - `pendiente`: «Descuento de stock pendiente» (factura) o «Reposición de stock pendiente» (NC). Con el comprobante autorizado aparece «Aplicar ahora» (`POST .../stock`; un `409` refresca); si sigue pendiente con ARCA, se aplica solo al autorizarse.
  - `cancelado`: «Descuento de stock cancelado por la anulación» (su fecha es la de la anulación y no se muestra).
