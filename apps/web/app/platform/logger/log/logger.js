import pino from "pino";
import { URL } from "url";

// Bun ≤1.2 no soporta bien worker_threads N-API (thread-stream falla con
// napi_register_module_v1). En entornos bun arrancamos pino sin transport
// (stdout JSON puro). En node prod el pino-prisma-transport + pino-pretty
// corren normalmente.
const isBun = typeof process.versions.bun === "string";

const transport = isBun
    ? undefined
    : pino.transport({
        targets: [
            ...(process.env.NODE_ENV !== "production"
                ? [{ target: "pino-pretty", level: "debug", options: { colorize: true } }]
                : []),
            {
                target: new URL("./pino-prisma-transport.js", import.meta.url).href,
                level: "info",
            },
        ],
    });

const logger = transport
    ? pino({ base: { service: "coco-api" } }, transport)
    : pino({ base: { service: "coco-api" } });

const close = async () => {
    if (!transport) return;
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Transport close timeout.")), 5000);
    });
    await Promise.race([transport.end(), timeout]);
};

/**
 * @param service
 */
function Logger(service) {
    return transport
        ? pino({ base: { service } }, transport)
        : pino({ base: { service } });
}

export { logger, Logger, close };
