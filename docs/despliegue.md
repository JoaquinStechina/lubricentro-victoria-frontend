# Despliegue

> **Regla:** un push a `master` despliega a producción solo. El cliente usa el sistema durante el día, así que **no se pushea a `master` sin el OK del dueño**. Un push a cualquier otra rama solo corre la CI.

## Build

- **Salida `standalone`.** `next.config.ts` usa `output: "standalone"`. El `Dockerfile` (multi-stage, `node:20-slim`) copia `.next/standalone` y corre `node server.js`.
- **`NEXT_PUBLIC_API_URL`** es la única variable. Se **hornea al compilar**, así que en el `docker-compose.yml` del VPS entra como `build-arg`, no como variable de runtime. En producción apunta al mismo origen que sirve nginx.

## CI/CD (`.github/workflows/`)

| Workflow | Cuándo corre | Qué hace |
|---|---|---|
| `ci.yml` | Push a cualquier rama que no sea `master` y PRs. | `npm ci`, `tsc --noEmit`, `eslint .` y `npm run build`. |
| `deploy.yml` | Push a `master`. | CI y, si pasa, SSH al VPS para ejecutar `deploy-frontend.sh`. Usa los secretos `VPS_SSH_KEY`, `VPS_HOST`, `VPS_USER` y `VPS_KNOWN_HOSTS`. |

`deploy-frontend.sh` hace esto, en orden:

1. Toma el mismo lock que el deploy del backend, para que los dos no recreen contenedores a la vez.
2. `git pull`.
3. `docker compose build frontend`.
4. `docker compose up -d --no-deps frontend`.

**Para frenar un deploy**, cancelá el run en GitHub Actions antes de que arranque el job de deploy.

**La llave del servidor se verifica.** `VPS_KNOWN_HOSTS` es la línea de `known_hosts` con la llave pública del VPS, cargada a mano como secreto del repo. El workflow entra con `StrictHostKeyChecking=yes`: si el servidor presenta otra llave, no se despliega, y sin el secreto el deploy falla a propósito. Antes hacía `ssh-keyscan` en cada deploy y aceptaba cualquier llave. Cómo obtener y verificar la línea: `docs/despliegue.md` del backend, «Cómo entra la CI al VPS». El valor no va en el repo: este repo es público.

## En el VPS

- **Ubicación.** El clon vive en `/opt/lubricentro-victoria/lubricentro-victoria-front/`.
- **nginx.** Sirve todo lo que no es `/api/` ni `/uploads/imagenes/` desde este contenedor (puerto 3000), en el mismo origen que la API. nginx **no** pide contraseña: la pide la API (ver [acceso.md](acceso.md)). Las páginas son públicas pero vacías; los datos llegan de la API solo con sesión.
- **Más detalle.** El resto de la infraestructura está en `docs/despliegue.md` del backend.

## Orden al desplegar cambios que tocan los dos repos

1. **Primero el backend,** sobre todo si trae una migración o un endpoint nuevo.
2. **Después el frontend.** Si el frontend sale primero, puede llamar a endpoints que todavía no existen.

**Excepción: el acceso con clave** (rama `feat/acceso-con-clave`) va al revés, **primero el frontend**. El frontend nuevo funciona igual con el backend viejo, y cuando sale el backend que pide la clave la pantalla «Entrar» ya está. Los pasos completos, incluida la clave en el `.env`, están en `docs/acceso.md` del backend.
