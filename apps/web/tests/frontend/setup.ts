/**
 * @module tests/frontend/setup
 * @description Vitest setup global — extiende expect con @testing-library/jest-dom,
 * arranca el servidor MSW para los component tests que mockean la API legacy
 * (`PUBLIC_API_BASE_URL`), y poliyfilla APIs del DOM ausentes en jsdom
 * (`scrollIntoView`), de modo que los componentes de `@coco/ui-kit` que las
 * usan en efectos no revienten bajo el entorno de test.
 */
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@tests/frontend/frontend/mocks/server";

// jsdom no implementa Element.prototype.scrollIntoView; los componentes que lo
// llaman en efectos (p.ej. ui-kit/Select) fallarían sin este polyfill.
if (!("scrollIntoView" in Element.prototype)) {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    value: () => {},
    writable: true,
  });
}

// Ciclo de vida MSW: los tests pueden registrar handlers ad-hoc con
// `server.use(...)`; se resetean entre tests para no filtrar estado.
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
