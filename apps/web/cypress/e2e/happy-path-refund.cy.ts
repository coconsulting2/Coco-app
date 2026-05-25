/**
 * Happy path — Reembolsos: el solicitante consulta su dashboard de reembolsos
 * (saldo de wallet + historial por solicitud).
 *
 * Requiere el stack levantado (`docker compose -f docker-compose.dev.yml up`)
 * + seed CocoUAT (org 101) con el wallet y al menos una solicitud con
 * comprobantes para el usuario. Credenciales vía CYPRESS_SOLICITANTE_*.
 */
describe('Happy path · Reembolsos del solicitante', () => {
  beforeEach(() => {
    cy.login(Cypress.env('SOLICITANTE_USER'), Cypress.env('SOLICITANTE_PASSWORD'));
  });

  afterEach(() => {
    cy.logout();
  });

  it('muestra el saldo en wallet y el historial por solicitud', () => {
    cy.visit('/reembolso');

    cy.contains('Saldo en wallet').should('be.visible');
    cy.contains('Total reembolsos aprobados').should('be.visible');
    cy.contains('h2', 'Historial por solicitud').should('be.visible');

    // El historial es una tabla con la columna "Monto reembolsable", o el
    // estado vacío "Sin reembolsos previos" cuando no hay solicitudes.
    cy.get('body').then(($body) => {
      if ($body.find('table').length > 0) {
        cy.contains('Monto reembolsable').should('be.visible');
      } else {
        cy.contains('Sin reembolsos previos').should('be.visible');
      }
    });
  });
});
