/**
 * Happy path — Agencia de viajes: atiende (cotiza) una solicitud y la finaliza.
 *
 * Requiere el stack levantado (`docker compose -f docker-compose.dev.yml up`)
 * + seed CocoUAT con una solicitud en status 5 (en agencia). La búsqueda de
 * vuelos/hospedaje usa Duffel; este happy path cubre el caso en que la
 * solicitud ya tiene seleccionados/o no requiere vuelo y hospedaje, de modo
 * que "Finalizar atención" esté habilitado. Credenciales vía CYPRESS_AV_*.
 */
describe('Happy path · Agencia atiende y finaliza una solicitud', () => {
  beforeEach(() => {
    cy.login(Cypress.env('AV_USER'), Cypress.env('AV_PASSWORD'));
  });

  afterEach(() => {
    cy.logout();
  });

  it('abre una atención pendiente y la marca como atendida', () => {
    cy.visit('/atenciones');
    cy.contains('h1', 'Atenciones').should('be.visible');

    cy.contains('a', 'Abrir').first().click({ force: true });
    cy.url().should('include', '/atender-solicitud/');
    cy.contains('h1', 'Agencia de viajes').should('be.visible');

    // Finaliza la atención (botón habilitado cuando las necesidades de
    // vuelo/hospedaje están cubiertas).
    cy.contains('button', 'Finalizar atención').click();
    cy.contains('button', 'Confirmar').click();

    cy.url().should('include', '/dashboard');
  });
});
