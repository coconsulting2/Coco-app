import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CERT_DIR = path.resolve(process.cwd(), "certs");
const hasCerts =
  fs.existsSync(path.join(CERT_DIR, "server.key")) &&
  fs.existsSync(path.join(CERT_DIR, "server.crt"));

const httpsConfig = hasCerts
  ? {
      key: fs.readFileSync(path.join(CERT_DIR, "server.key")),
      cert: fs.readFileSync(path.join(CERT_DIR, "server.crt")),
    }
  : undefined;

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    ...(hasCerts ? [] : [basicSsl()]),
  ],
  // Belt + suspenders: resolveAlias garantiza que `~/...` resuelve aunque
  // vite-tsconfig-paths falle (en algunos casos no captura imports dentro de .js).
  //
  // Form-array para garantizar orden: `~/prisma/*` (más específico) ANTES que
  // `~` (catch-all → app/). Sin esto, Vite resuelve `~/prisma/...` como
  // `app/prisma/...` que no existe.
  resolve: {
    alias: [
      { find: /^~\/prisma\/(.*)$/, replacement: path.resolve(__dirname, "prisma") + "/$1" },
      { find: /^~\/(.*)$/, replacement: path.resolve(__dirname, "app") + "/$1" },
      { find: "@components", replacement: path.resolve(__dirname, "app/shared/ui") },
      { find: "@utils", replacement: path.resolve(__dirname, "app/shared/utils") },
      { find: "@config", replacement: path.resolve(__dirname, "app/shared/config") },
      { find: "@type", replacement: path.resolve(__dirname, "app/shared/types") },
      { find: "@layouts", replacement: path.resolve(__dirname, "app/shared/layouts") },
      { find: "@data", replacement: path.resolve(__dirname, "app/shared/data") },
      { find: "@stores", replacement: path.resolve(__dirname, "app/shared/stores") },
      { find: "@assets", replacement: path.resolve(__dirname, "app/shared/assets") },
      { find: "@styles", replacement: path.resolve(__dirname, "app/shared/styles") },
    ],
  },
  server: {
    port: 5173,
    https: httpsConfig,
    host: "0.0.0.0",
    open: "/login",
    hmr: false,
    watch: {
      usePolling: true,
    },
  },
  optimizeDeps: {
    exclude: ["@prisma/client"],
  },
  ssr: {
    noExternal: [],
    external: [
      "@prisma/client",
      "bcrypt",
      "mongodb",
      "nodemailer",
      "web-push",
      "soap",
      "@aws-sdk/client-s3",
      "@aws-sdk/s3-request-presigner",
      "node-cron",
      "multer",
      "pino",
      "pino-http",
    ],
  },
});
