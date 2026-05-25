/**
 * Author: Emiliano Deyta Illescas
 *
 * Description:
 * Unit tests for RolesAdmin. El componente ahora es prop-driven + `useFetcher`
 * (migrado fuera de `apiRequest`): recibe `initialData` + `permissionRows` +
 * `csrfToken` por prop y POSTea los intents create/update/delete al action de
 * la route padre (`routes/_app/admin/roles`). Usamos `createRoutesStub` para
 * proveer el router de RR7 y simular ese action. Cubre el render inicial,
 * la validación del formulario, el flujo create/update/delete por fetcher,
 * el toggle de permisos y los guards de admin/usuarios activos.
 */

import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import RolesAdmin from "@components/RolesAdmin";
import type { Role } from "@type/Role";

const fixedRoles: Role[] = [
  {
    role_id: 1,
    name: "Administrador",
    permissions: ["role:manage_permissions"],
    max_authorization_amount: null,
    expiration_date: null,
    is_admin: true,
    active_users_count: 3,
  },
  {
    role_id: 2,
    name: "Solicitante",
    permissions: ["viajes.solicitud.crear"],
    max_authorization_amount: 0,
    expiration_date: null,
    is_admin: false,
    active_users_count: 5,
  },
];

const twoAdminRoles: Role[] = [
  { ...fixedRoles[0] },
  {
    role_id: 3,
    name: "Admin secundario",
    permissions: ["role:manage_permissions"],
    max_authorization_amount: null,
    expiration_date: null,
    is_admin: true,
    active_users_count: 1,
  },
];

type RolesActionResult =
  | { ok: true; intent: "create" | "update"; role: Role }
  | { ok: true; intent: "delete"; roleId: number }
  | { ok: false; error: string };

/**
 * Monta RolesAdmin dentro de un router stub que emula el action de
 * `routes/_app/admin/roles`. Devuelve un getter del último FormData recibido.
 */
function renderRoles(initialData: Role[]) {
  const received: { form: FormData | null } = { form: null };
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <RolesAdmin initialData={initialData} permissionRows={[]} csrfToken="tok-1" />
      ),
      action: async ({ request }) => {
        const form = await request.formData();
        received.form = form;
        const intent = form.get("_intent")?.toString();
        if (intent === "delete") {
          return Response.json({
            ok: true,
            intent: "delete",
            roleId: Number(form.get("role_id")),
          } satisfies RolesActionResult);
        }
        const permissions = JSON.parse(form.get("permissions")?.toString() ?? "[]");
        const amountRaw = form.get("max_authorization_amount")?.toString() ?? "";
        const role: Role = {
          role_id: intent === "update" ? Number(form.get("role_id")) : 999,
          name: form.get("name")?.toString() ?? "",
          permissions,
          max_authorization_amount: amountRaw === "" ? null : Number(amountRaw),
          expiration_date: null,
          is_admin: form.get("is_admin")?.toString() === "true",
          active_users_count: 0,
        };
        return Response.json({
          ok: true,
          intent: intent === "update" ? "update" : "create",
          role,
        } satisfies RolesActionResult);
      },
    },
  ]);
  render(<Stub initialEntries={["/"]} />);
  return received;
}

describe("RolesAdmin", () => {
  it("renders the seed roles in the table with admin pill and counts", () => {
    renderRoles(fixedRoles);
    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.getByText("Solicitante")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText(/2 roles registrados/i)).toBeInTheDocument();
    expect(screen.getByText(/1 administrador/i)).toBeInTheDocument();
  });

  it("opens the create dialog and shows the empty form", async () => {
    const user = userEvent.setup();
    renderRoles(fixedRoles);
    await user.click(screen.getByRole("button", { name: /\+ nuevo rol/i }));
    expect(
      await screen.findByRole("heading", { name: /nuevo rol/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ej: autorizador regional/i)).toHaveValue("");
  });

  it("blocks submission with a name shorter than 2 characters", async () => {
    const user = userEvent.setup();
    renderRoles(fixedRoles);
    await user.click(screen.getByRole("button", { name: /\+ nuevo rol/i }));

    const nameInput = await screen.findByPlaceholderText(/ej: autorizador regional/i);
    await user.type(nameInput, "x");
    await user.click(screen.getByRole("button", { name: /crear rol/i }));

    expect(await screen.findByText(/al menos 2 caracteres/i)).toBeInTheDocument();
  });

  it("creates a role through the action and shows the success toast and a new row", async () => {
    const user = userEvent.setup();
    const received = renderRoles(fixedRoles);
    await user.click(screen.getByRole("button", { name: /\+ nuevo rol/i }));

    await user.type(
      await screen.findByPlaceholderText(/ej: autorizador regional/i),
      "Auditor regional",
    );
    await user.click(screen.getByRole("button", { name: /crear rol/i }));

    expect(await screen.findByText(/rol creado correctamente/i)).toBeInTheDocument();
    expect(await screen.findByText("Auditor regional")).toBeInTheDocument();
    expect(screen.getByText(/3 roles registrados/i)).toBeInTheDocument();
    await waitFor(() => expect(received.form).not.toBeNull());
    expect(received.form!.get("_intent")).toBe("create");
    expect(received.form!.get("_csrf")).toBe("tok-1");
    expect(received.form!.get("name")).toBe("Auditor regional");
  });

  it("opens the edit dialog pre-loaded with the role's data", async () => {
    const user = userEvent.setup();
    renderRoles(fixedRoles);

    const solicitanteRow = screen.getByText("Solicitante").closest("tr") as HTMLElement;
    await user.click(within(solicitanteRow).getByRole("button", { name: /editar/i }));

    expect(
      await screen.findByRole("heading", { name: /editar rol: solicitante/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ej: autorizador regional/i)).toHaveValue("Solicitante");
  });

  it("warns before deleting a role with active users and removes it on confirm", async () => {
    const user = userEvent.setup();
    const received = renderRoles(fixedRoles);

    const solicitanteRow = screen.getByText("Solicitante").closest("tr") as HTMLElement;
    await user.click(within(solicitanteRow).getByRole("button", { name: /eliminar/i }));

    expect(
      await screen.findByRole("heading", { name: /eliminar rol/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/5 usuarios activos/i)).toBeInTheDocument();
    expect(screen.getByText(/reasígnalos antes de eliminar el rol/i)).toBeInTheDocument();

    const dlg = screen.getByRole("dialog");
    await user.click(within(dlg).getByRole("button", { name: /^eliminar$/i }));

    expect(await screen.findByText(/rol "solicitante" eliminado/i)).toBeInTheDocument();
    expect(screen.queryByText("Solicitante")).not.toBeInTheDocument();
    await waitFor(() => expect(received.form).not.toBeNull());
    expect(received.form!.get("_intent")).toBe("delete");
    expect(received.form!.get("role_id")).toBe("2");
  });

  it("blocks deletion of the last admin role and disables the confirm button", async () => {
    const user = userEvent.setup();
    renderRoles(fixedRoles);

    const adminRow = screen.getByText("Administrador").closest("tr") as HTMLElement;
    await user.click(within(adminRow).getByRole("button", { name: /eliminar/i }));

    expect(await screen.findByText(/último rol administrador/i)).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).queryByRole("button", { name: /^eliminar$/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cerrar/i })).toBeInTheDocument();
  });

  it("allows deleting one admin role when more than one admin exists", async () => {
    const user = userEvent.setup();
    renderRoles(twoAdminRoles);

    const secondaryRow = screen
      .getByText("Admin secundario")
      .closest("tr") as HTMLElement;
    await user.click(within(secondaryRow).getByRole("button", { name: /eliminar/i }));

    expect(
      await within(screen.getByRole("dialog")).findByRole("button", { name: /^eliminar$/i }),
    ).toBeInTheDocument();
  });

  it("renders the empty state when no initial roles are provided", () => {
    renderRoles([]);
    expect(screen.getByText(/No hay roles registrados/i)).toBeInTheDocument();
  });

  it("surfaces the action error toast when the action fails", async () => {
    const user = userEvent.setup();
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: () => (
          <RolesAdmin initialData={fixedRoles} permissionRows={[]} csrfToken="tok-1" />
        ),
        action: async () =>
          Response.json(
            { ok: false, error: "Ya existe un rol con ese nombre" } satisfies RolesActionResult,
            { status: 409 },
          ),
      },
    ]);
    render(<Stub initialEntries={["/"]} />);

    await user.click(screen.getByRole("button", { name: /\+ nuevo rol/i }));
    await user.type(
      await screen.findByPlaceholderText(/ej: autorizador regional/i),
      "Duplicado",
    );
    await user.click(screen.getByRole("button", { name: /crear rol/i }));

    expect(await screen.findByText(/ya existe un rol con ese nombre/i)).toBeInTheDocument();
  });

  it("toggles a single permission on the create form", async () => {
    const user = userEvent.setup();
    renderRoles(fixedRoles);
    await user.click(screen.getByRole("button", { name: /\+ nuevo rol/i }));

    const reportesCheckbox = await screen.findByRole("checkbox", {
      name: /ver reportes/i,
    });
    expect(reportesCheckbox).not.toBeChecked();
    await user.click(reportesCheckbox);
    expect(reportesCheckbox).toBeChecked();

    expect(screen.getByText(/^\(1\/\d+\)$/)).toBeInTheDocument();
  });

  it("selects every permission in a module with the toggle module button", async () => {
    const user = userEvent.setup();
    renderRoles(fixedRoles);
    await user.click(screen.getByRole("button", { name: /\+ nuevo rol/i }));

    await screen.findByPlaceholderText(/ej: autorizador regional/i);
    const reportesHeader = screen.getByText("Reportes");
    const reportesModule = reportesHeader.closest("div.p-3") as HTMLElement;
    const toggleAll = within(reportesModule).getByRole("button", {
      name: /seleccionar todos/i,
    });
    await user.click(toggleAll);

    const reportesCheckbox = screen.getByRole("checkbox", { name: /ver reportes/i });
    const exportarCheckbox = screen.getByRole("checkbox", {
      name: /exportar reportes/i,
    });
    expect(reportesCheckbox).toBeChecked();
    expect(exportarCheckbox).toBeChecked();
  });

  it("updates a role through the edit dialog and shows the actualizado toast", async () => {
    const user = userEvent.setup();
    const received = renderRoles(fixedRoles);

    const solicitanteRow = screen.getByText("Solicitante").closest("tr") as HTMLElement;
    await user.click(within(solicitanteRow).getByRole("button", { name: /editar/i }));

    const nameInput = await screen.findByPlaceholderText(/ej: autorizador regional/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Solicitante avanzado");
    await user.click(screen.getByRole("button", { name: /actualizar/i }));

    expect(await screen.findByText(/rol actualizado/i)).toBeInTheDocument();
    expect(screen.getByText("Solicitante avanzado")).toBeInTheDocument();
    await waitFor(() => expect(received.form).not.toBeNull());
    expect(received.form!.get("_intent")).toBe("update");
    expect(received.form!.get("role_id")).toBe("2");
  });
});
