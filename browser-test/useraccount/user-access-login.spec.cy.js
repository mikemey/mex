
const { RegistrationPage, LoginPage, HomePage } = require('../pages')

describe('Login', () => {
  const regpage = new RegistrationPage()
  const loginpage = new LoginPage()
  const homepage = new HomePage()
  let registeredUser

  before(() => cy.task('seedTestData').then(() =>
    cy.task('getRegisteredUser').then(res => { registeredUser = res })
  ))

  it('successful registration + login new user', () => {
    const email = 'newuser@you.com'
    const password = 'helloyou'
    regpage.visit()
    regpage.register(email, password).registerButton().click()
    loginpage.assertPageActive()
    loginpage.login(email, password)
    homepage.assertPageActive()
  })

  it('existing user attempts logins', () => {
    homepage.visit()
    loginpage.assertPageActive()
    loginpage.message().contains('Please log-in')

    loginpage.login('X' + registeredUser.email, registeredUser.password)
    loginpage.assertPageActive()
    loginpage.errorMsg().contains('Password or username is incorrect')
    loginpage.email().should('have.attr', 'value', 'X' + registeredUser.email)

    loginpage.login(registeredUser.email, 'X' + registeredUser.password)
    loginpage.errorMsg().contains('Password or username is incorrect')
    loginpage.email().should('have.attr', 'value', registeredUser.email)

    loginpage.login(registeredUser.email, registeredUser.password)
    homepage.assertPageActive()
  })
})
