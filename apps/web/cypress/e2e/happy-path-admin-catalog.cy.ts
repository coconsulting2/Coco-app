/**
 * Happy path — Administrador: alta de un catálogo (centro de costo).
 *
 * Requiere el stack levantado (`docker compose -f docker-compose.dev.yml up`)
 * + seed CocoUAT (org 101). Credenciales vía CYPRESS_ADMIN_*.
 */
describe('Happy path · Admin crea un centro de costo', () => {
  beforeEach(() => {
    cy.login(Cypress.env('ADMIN_USER'), Cypress.env('ADMIN_PASSWORD'));
  });

  afterEach(() => {
    cy.logout();
  });

  it('crea un nuevo centro de costo y lo ve en la tabla', () => {
    const suffix = Date.now().toString().slice(-5);
    const code = `CC-E2E-${suffix}`;
    const name = `Centro E2E ${suffix}`;

    cy.visit('/admin/cost-centers');
    cy.contains('h1', 'Centros de costo').should('be.visible');

    cy.contains('button', 'Nuevo centro').click();

    cy.get('input[placeholder="CC-100"]').type(code);
    cy.get('input[placeholder="Tesorería Corporativa"]').type(name);

    cy.contains('button', 'Crear').click();

    // La tabla revalida e incluye el nuevo registro.
    cy.contains(code).should('be.visible');
    cy.contains(name).should('be.visible');
  });
});
