# DEPLOY — coco-app

Flujo de despliegue de producción para `coco-app`. CI/CD vive en
`.github/workflows/build.yml` (push/PR a `main`).

## Pipeline (GitHub Actions → GHCR)

En **push a `main`**:

1. `test` — `bun install --frozen-lockfile`, `prisma generate`,
   `bun --filter @coco/web typecheck` (no bloqueante: el typegen
   `.react-router` sólo existe tras `react-router build`, por eso
   `continue-on-error`), y `bun run test` (vitest del workspace).
2. `build-and-push` — construye la imagen Docker (`Dockerfile`, target
   `runtime`), hace login a GHCR con `GITHUB_TOKEN`, y publica:
   - `ghcr.io/coconsulting2/coco-app:latest`
   - `ghcr.io/coconsulting2/coco-app:<git-sha>`
3. `migrate-deploy` — aplica migraciones con
   `bunx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma`.

> **`prisma migrate deploy`, NO `prisma db push`.** `migrate deploy` aplica
> sólo las migraciones versionadas en `packages/db/prisma/migrations/` sin
> generar nuevas ni perder datos. `db push` queda reservado para desarrollo
> local.

En **pull request a `main`** sólo corre `test` (no se publica imagen ni se
migra la base).

## Secrets / env requeridos

GitHub Actions (Settings → Secrets and variables → Actions):

| Secret           | Uso                                                            |
|------------------|----------------------------------------------------------------|
| `GITHUB_TOKEN`   | Provisto automáticamente; login y push a GHCR.                 |
| `DATABASE_URL`   | Postgres destino del `migrate-deploy` (prod/staging).          |

Runtime de la app (inyectar como env del contenedor / orquestador — NO commitear):

| Var                     | Descripción                                                  |
|-------------------------|--------------------------------------------------------------|
| `DATABASE_URL`          | Conexión Postgres (Prisma).                                  |
| `JWT_SECRET`            | Firma de JWT.                                                 |
| `SESSION_SECRET`        | Firma de la cookie de sesión.                                |
| `AES_SECRET_KEY`        | 32 chars — cifrado AES-256 de email/teléfono.                |
| `CHAT_CURSOR_SECRET`    | Cifrado de cursores de chat.                                 |
| `CHAT_MESSAGE_SECRET`   | Cifrado de mensajes de chat.                                 |
| `API_KEY_HASH_PEPPER`   | Pepper HMAC-SHA256 de API keys.                              |
| `FILE_STORE_DRIVER`     | `s3` (S3/R2/MinIO) o `gridfs` (fallback). Default `gridfs`.   |
| `S3_ENDPOINT`           | Endpoint S3-compatible (vacío para AWS S3 real).             |
| `S3_REGION`             | Región S3.                                                   |
| `S3_BUCKET`             | Bucket de comprobantes.                                      |
| `S3_ACCESS_KEY_ID`      | Credencial S3/R2/MinIO.                                       |
| `S3_SECRET_ACCESS_KEY`  | Credencial S3/R2/MinIO.                                       |
| `S3_FORCE_PATH_STYLE`   | `true` para MinIO; `false` para AWS S3.                      |
| `MONGO_URI`             | MongoDB GridFS — sólo si `FILE_STORE_DRIVER=gridfs`.         |
| `MAIL_USER` / `MAIL_PASSWORD` | SMTP (Nodemailer).                                      |
| `SCHEDULER_ENABLED`     | Activa los cron workers.                                      |

(Lista de nombres, no valores. Genera los secretos fuera del repo.)

## File storage: S3/R2/MinIO vs GridFS

El slice `receipts-cfdi` elige el adapter de `FileStore` por
`FILE_STORE_DRIVER`:

- `s3` → `S3FileStore` (`@aws-sdk/client-s3`). Compatible con AWS S3,
  Cloudflare R2 y MinIO. Configurado por las `S3_*`.
- `gridfs` (default) → `GridFsFileStore` (MongoDB GridFS). Fallback que no
  rompe nada existente; requiere `MONGO_URI`.

La selección está en `apps/web/app/contexts/receipts-cfdi/index.ts`
(`buildFileStore()`); la API pública de los use-cases no cambia.

### MinIO local (desarrollo)

`docker-compose.dev.yml` incluye un servicio `minio` (emula S3) y un one-shot
`createbuckets` que crea el bucket `coco-receipts`.

```bash
bun run docker:dev          # levanta postgres, mongo, minio, app, etc.
```

- API S3:  http://localhost:9000
- Consola: http://localhost:9001  (usuario/clave: `minioadmin` / `minioadmin`)

Para que la app use MinIO en local, pon `FILE_STORE_DRIVER=s3` (las `S3_*` ya
apuntan a MinIO en `.env.example`).

## Migraciones manuales (fuera de CI)

```bash
# Crear una migración nueva (desarrollo):
bun --filter @coco/db migrate

# Aplicar migraciones existentes a un entorno destino (CI/prod):
DATABASE_URL=... bunx prisma migrate deploy --schema=./packages/db/prisma/schema.prisma
```
