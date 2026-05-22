/**
 * @file app/entry.server.tsx
 * @description Bootstrap del proceso server-side. Ejecuta UNA sola vez al arrancar:
 *   - Patch BigInt.toJSON para que Prisma BigInt serialice como string (Organization.id).
 *   - Conecta MongoDB (GridFS) y Postgres (Prisma).
 *   - Arranca schedulers cron (escalation, refund deadline, approval substitute) gated por SCHEDULER_ENABLED.
 *
 * Tras el bootstrap, exporta el handler RRv7 que toma cada Request HTTP/HTTPS y lo
 * convierte en Response usando los loaders/actions del proyecto.
 */
import { PassThrough } from "node:stream";
import type { AppLoadContext, EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";

import { connectMongo } from "./platform/mongo/gridfs.server.js";
import { connectPostgres } from "./platform/db/prisma.server.js";

const ABORT_DELAY = 5_000;

// ─── BigInt JSON patch ──────────────────────────────────────────────────────
// Prisma devuelve BigInt para Organization.id y otros. JSON.stringify lanza
// TypeError por default; este patch hace que se serialicen como string.
if (!(BigInt.prototype as any).toJSON) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

// ─── One-time bootstrap (idempotent against HMR) ───────────────────────────
type GlobalWithBootstrap = typeof globalThis & {
  __cocoBootstrapped?: boolean;
};
const g = globalThis as GlobalWithBootstrap;

if (!g.__cocoBootstrapped) {
  g.__cocoBootstrapped = true;

  connectMongo().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[bootstrap] connectMongo failed:", err);
  });
  connectPostgres().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[bootstrap] connectPostgres failed:", err);
  });

  if (process.env.SCHEDULER_ENABLED === "true") {
    void (async () => {
      try {
        // Lazy imports: estos módulos requieren conexión a DB ya establecida.
        const { startScheduler } = await import("./platform/scheduler/index.js");
        const { startApprovalSubstituteCron } = await import(
          "./platform/scheduler/approval-substitute-cron.server.js"
        );
        startScheduler();
        await startApprovalSubstituteCron();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[bootstrap] scheduler start failed:", err);
      }
    })();
  }
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  return isbot(request.headers.get("user-agent") ?? "")
    ? handleBotRequest(request, responseStatusCode, responseHeaders, routerContext)
    : handleBrowserRequest(request, responseStatusCode, responseHeaders, routerContext);
}

function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  return new Promise<Response>((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onAllReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            // eslint-disable-next-line no-console
            console.error(error);
          }
        },
      },
    );
    setTimeout(abort, ABORT_DELAY);
  });
}

function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  return new Promise<Response>((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onShellReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) {
            // eslint-disable-next-line no-console
            console.error(error);
          }
        },
      },
    );
    setTimeout(abort, ABORT_DELAY);
  });
}
