import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CERT_DIR = path.resolve(__dirname, "certs");
const hasCerts =
  fs.existsSync(path.join(CERT_DIR, "server.key")) &&
  fs.existsSync(path.join(CERT_DIR, "server.crt"));

const httpsConfig = hasCerts
  ? {
      key: fs.readFileSync(path.join(CERT_DIR, "server.key")),
      cert: fs.readFileSync(path.join(CERT_DIR, "server.crt")),
    }
  : undefined;

const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    ...(hasCerts ? [] : [basicSsl()]),
  ],
  resolve: {
    alias: [
      // Workspace packages — explicit so Vite resolves to TS source.
      { find: "@coco/db", replacement: path.resolve(repoRoot, "packages/db/src/index.ts") },
      { find: /^@coco\/db\/(.*)$/, replacement: path.resolve(repoRoot, "packages/db/src") + "/$1" },
      { find: "@coco/contracts", replacement: path.resolve(repoRoot, "packages/contracts/src/index.ts") },
      { find: /^@coco\/contracts\/(.*)$/, replacement: path.resolve(repoRoot, "packages/contracts/src") + "/$1" },
      { find: "@coco/integrations", replacement: path.resolve(repoRoot, "packages/integrations/src/index.ts") },
      { find: /^@coco\/integrations\/(.*)$/, replacement: path.resolve(repoRoot, "packages/integrations/src") + "/$1" },
      { find: "@coco/ui-kit", replacement: path.resolve(repoRoot, "packages/ui-kit/src/index.ts") },
      { find: /^@coco\/ui-kit\/(.*)$/, replacement: path.resolve(repoRoot, "packages/ui-kit/src") + "/$1" },
      // App-local aliases (preserved from pre-monorepo layout).
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
    exclude: ["@prisma/client", "@coco/db", "@coco/integrations"],
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
