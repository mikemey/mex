describe('Registration', () => {
  beforeEach(() => {
    cy.visit('/register')
  })

  describe('page', () => {
    it('has correct form fields', () => {
      cy.get('input#email').should('have.attr', 'type', 'email')
      cy.get('input#email').should('have.attr', 'placeholder', 'Email')
      cy.get('input#password').should('have.attr', 'type', 'password')
      cy.get('input#confirmation').should('have.attr', 'type', 'password')
    })
  })
})