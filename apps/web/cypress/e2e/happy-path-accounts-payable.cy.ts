/**
 * Happy path — Cuentas por pagar: valida (aprueba) los comprobantes de una
 * solicitud pendiente.
 *
 * Requiere el stack levantado (`docker compose -f docker-compose.dev.yml up`)
 * + seed CocoUAT con una solicitud en estatus de comprobación con al menos un
 * comprobante pendiente de validar. Credenciales vía CYPRESS_CPP_*.
 */
describe('Happy path · CxP valida comprobantes', () => {
  beforeEach(() => {
    cy.login(Cypress.env('CPP_USER'), Cypress.env('CPP_PASSWORD'));
  });

  afterEach(() => {
    cy.logout();
  });

  it('abre una comprobación pendiente y aprueba un comprobante', () => {
    cy.visit('/comprobaciones');
    cy.contains('h1', 'Comprobaciones').should('be.visible');

    // Entra al primer "Validar" de la sección "Pendientes de validar".
    cy.contains('a', 'Validar').first().click({ force: true });
    cy.url().should('include', '/comprobar-gastos/');
    cy.contains('h1', 'Validar comprobantes').should('be.visible');

    // Aprueba el primer comprobante de la lista.
    cy.contains('button', 'Aprobar').first().click();
    cy.contains('button', 'Confirmar').click();

    // El loader revalida; el comprobante queda marcado como Aprobado.
    cy.contains('Aprobado').should('exist');
  });
});
