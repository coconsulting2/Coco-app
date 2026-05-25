/**
 * Happy path — N1 (Autorizador Nivel 1): aprueba una solicitud pendiente.
 *
 * Requiere el stack levantado (`docker compose -f docker-compose.dev.yml up`)
 * + seed CocoUAT con al menos una solicitud en status 2 (Primera Revisión)
 * asignada al N1. Credenciales vía CYPRESS_N1_*.
 */
describe('Happy path · N1 aprueba una solicitud', () => {
  beforeEach(() => {
    cy.login(Cypress.env('N1_USER'), Cypress.env('N1_PASSWORD'));
  });

  afterEach(() => {
    cy.logout();
  });

  it('abre una solicitud pendiente y la autoriza', () => {
    cy.visit('/autorizaciones');
    cy.contains('h1', 'Autorizaciones').should('be.visible');

    // Entra al primer link de detalle/autorización de la bandeja.
    cy.get('a[href*="/autorizar-solicitud/"], a[href*="/detalles-solicitud/"]')
      .first()
      .click({ force: true });

    // Si el link fue a detalles, navega al de autorización.
    cy.url().then((url) => {
      if (!url.includes('/autorizar-solicitud/')) {
        cy.get('a[href*="/autorizar-solicitud/"]').first().click({ force: true });
      }
    });
    cy.url().should('include', '/autorizar-solicitud/');

    cy.contains('button', 'Aceptar').click();
    cy.contains('button', 'Confirmar').click();

    // El action redirige a /dashboard tras la aprobación.
    cy.url().should('include', '/dashboard');
  });
});
