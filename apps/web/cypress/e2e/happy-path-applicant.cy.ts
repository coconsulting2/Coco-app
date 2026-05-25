/**
 * Happy path — Solicitante: crea y envía una nueva solicitud de viaje.
 *
 * Requiere el stack levantado (`docker compose -f docker-compose.dev.yml up`)
 * con seed CocoUAT (org 101). Credenciales vía CYPRESS_SOLICITANTE_*.
 */
describe('Happy path · Solicitante crea y envía una solicitud', () => {
  beforeEach(() => {
    cy.login(Cypress.env('SOLICITANTE_USER'), Cypress.env('SOLICITANTE_PASSWORD'));
  });

  afterEach(() => {
    cy.logout();
  });

  it('completa el formulario y la solicitud llega al dashboard', () => {
    cy.get('a[href="/crear-solicitud"]').first().click({ force: true });
    cy.url().should('include', '/crear-solicitud');

    cy.get('input[name="origin_country_name"]').first().type('México');
    cy.get('input[name="origin_city_name"]').first().type('Monterrey');
    cy.get('input[name="destination_country_name"]').first().type('Estados Unidos');
    cy.get('input[name="destination_city_name"]').first().type('Austin');

    cy.get('input[name="beginning_date"]').first().type('2026-11-10');
    cy.get('input[name="ending_date"]').first().type('2026-11-14');
    cy.get('input[name="beginning_time"]').first().type('09:00');
    cy.get('input[name="ending_time"]').first().type('18:00');

    cy.get('input[name="plane_needed"]').check();
    cy.get('input[name="hotel_needed"]').check();

    cy.get('input[name="requested_fee"]').type('12000');
    cy.get('textarea[name="notes"]').type('Solicitud happy-path E2E (Cypress).');

    cy.contains('button', 'Enviar Solicitud').click();
    cy.url().should('include', '/dashboard');
  });
});
