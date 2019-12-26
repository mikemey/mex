const { LoginPage, RegistrationPage, HomePage } = require('./page-objects')

const regpage = new RegistrationPage()
const loginpage = new LoginPage()
const homepage = new HomePage()

Cypress.Commands.add('loginRegisteredUser', () => cy.task('getRegisteredUser')
  .then(cy.loginUser)
)

Cypress.Commands.add('registerAndLoginUser', (email, password = 'abcdefghijk') => {
  regpage.visit()
  regpage.register(email, password).registerButton().click()
  return cy.loginUser({ email, password })
})

Cypress.Commands.add('loginUser', ({ email, password }) => {
  loginpage.visit()
  loginpage.login(email, password)
  homepage.assertPageActive()
  return cy.wrap({ email, password })
})

Cypress.Commands.add('sendToAddress',
  (address, amount) => cy.task('sendToAddress', { address, amount })
)

Cypress.Commands.add('generateUnrelatedTxs', () => cy.task('generateUnrelatedTxs'))

Cypress.Commands.add('generateBlocksWithInfo',
  count => cy.task('generateBlocksWithInfo', count)
)
