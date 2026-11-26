# Acceso con clave

El sistema pide **una sola clave**, sin usuario. Quien la controla es la API (backend: `docs/acceso.md`), con una cookie de sesión `httpOnly` que el frontend nunca lee. El frontend solo hace tres cosas: la pantalla para entrar, reaccionar al `401` y el botón «Salir».

## Pantalla «Entrar» (`/entrar`)

- Un campo de clave y el botón **Entrar**. Manda `POST /api/acceso/entrar { clave }`.
- **Al entrar, vuelve a la página de `?volver=`.** `volverSeguro()` solo acepta rutas de este mismo sitio: cualquier otra cosa (`//otro.sitio`, `https://…`, `javascript:…`) va al inicio, porque el valor llega por la URL.
- **Mensajes** tal como los manda la API:
  - clave incorrecta (`401`);
  - demasiados intentos (`429`, con los minutos que faltan);
  - acceso sin configurar (`503`).
- **Al abrir la pantalla** consulta `GET /api/acceso/estado`:
  - con sesión vigente, sigue de largo a `volver`;
  - si la API avisa un problema (por ejemplo, falta `CLAVE_ACCESO_HASH`), lo muestra.

## Sesión vencida: el `401`

- **`fetchApi` (`app/lib/sesion.ts`) es el único `fetch` hacia la API.** Lo usan `apiFetch`, `apiDownload`, `fetchFacturacion`, el `DELETE` de equivalencias y la subida de archivos.
- **Qué hace:**
  - manda la cookie: `credentials: "include"`, necesario en desarrollo, donde la API está en otro puerto;
  - ante un `401` lleva a `/entrar?volver=<página actual>` con una navegación completa, y lanza `SesionVencida`;
  - **no** redirige los `401` de `/api/acceso/*`: ahí el `401` es «clave incorrecta» y lo maneja la pantalla.
- **Si varias llamadas reciben `401` a la vez**, se navega una sola vez.
- **Lo que no se guardó se pierde.** Como la sesión dura 30 días y no se renueva sola, vence una vez por mes, siempre mientras alguien está usando el sistema.
- **Facturar con la sesión vencida no factura dos veces.** El `401` llega antes de que la API haga nada, y el reintento después de entrar es una emisión nueva.

## PDF de los comprobantes

- **El enlace del QR para el cliente no pide sesión**: es `/api/publico/c/<token>` del backend y lo abre el celular del cliente. Crear o ver el enlace sí la pide (lo hace el diálogo, con `fetchFacturacion`).
- **«Descargar PDF» es un link a la API**, así el navegador lo abre en otra pestaña con su nombre de archivo.
- **Clic común:**
  1. abre la pestaña en el clic (si se abre después, el navegador la bloquea);
  2. confirma la sesión con `GET /api/acceso/estado`;
  3. recién ahí carga el PDF.

  Sin sesión, cierra la pestaña y va a `/entrar`.
- **Con Ctrl, rueda del mouse o «Abrir en otra pestaña»** se usa el `href` tal cual. El navegador manda la cookie igual; si la sesión venció, esa pestaña muestra el mensaje de error de la API.

## «Salir»

- Está en la cabecera de todas las pantallas, al lado del selector de tema.
- Manda `POST /api/acceso/salir`, que borra la cookie de **este** navegador, y va a `/entrar`.
- Las demás PC siguen con su sesión hasta que vence o se cambia la clave.

## Desarrollo

- El backend necesita `CLAVE_ACCESO_HASH` en su `.env` (`npm run clave:hash`), o `ACCESO_DESACTIVADO=1` para trabajar sin clave.
- La API responde CORS con credenciales para `FRONTEND_URL` (`http://localhost:3000`).
- Las fotos (`<img>` hacia `:4000`) llevan la cookie solas: `localhost:3000` y `localhost:4000` son el mismo *site*.

## Al desplegar

Primero este frontend y después el backend. Los pasos completos, incluida la clave en el `.env` del VPS, están en `docs/acceso.md` del backend.
