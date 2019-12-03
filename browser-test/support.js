const { LoginPage, HomePage } = require('./pages')

const loginpage = new LoginPage()
const homepage = new HomePage()

Cypress.Commands.add('loginRegisteredUser', () => cy.task('getRegisteredUser')
  .then(registeredUser => {
    loginpage.visit()
    loginpage.login(registeredUser.email, registeredUser.password)
    homepage.assertPageActive()
    return cy.wrap(registeredUser)
  })
)
