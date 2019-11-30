Cypress.Commands.add('login', (email, password) => {
  cy.get('input#email').type(email)
  cy.get('input#password').type(password)
})

Cypress.Commands.add('dropDatabase', () => {
  cy.exec('mongo mex-test --eval "db.dropDatabase()"')
})
