/**
 * Happy path — N2 (Autorizador Nivel 2): aprueba una solicitud escalada.
 *
 * Requiere el stack levantado (`docker compose -f docker-compose.dev.yml up`)
 * + seed CocoUAT con una solicitud en status 3 (Segunda Revisión) asignada al
 * N2 (p.ej. escalada por monto desde N1). Credenciales vía CYPRESS_N2_*.
 */
describe('Happy path · N2 aprueba una solicitud escalada', () => {
  beforeEach(() => {
    cy.login(Cypress.env('N2_USER'), Cypress.env('N2_PASSWORD'));
  });

  afterEach(() => {
    cy.logout();
  });

  it('abre la solicitud en segunda revisión y la autoriza', () => {
    cy.visit('/autorizaciones');
    cy.contains('h1', 'Autorizaciones').should('be.visible');

    cy.get('a[href*="/autorizar-solicitud/"], a[href*="/detalles-solicitud/"]')
      .first()
      .click({ force: true });

    cy.url().then((url) => {
      if (!url.includes('/autorizar-solicitud/')) {
        cy.get('a[href*="/autorizar-solicitud/"]').first().click({ force: true });
      }
    });
    cy.url().should('include', '/autorizar-solicitud/');

    cy.contains('button', 'Aceptar').click();
    cy.contains('button', 'Confirmar').click();

    cy.url().should('include', '/dashboard');
  });
});
