
const { RegistrationPage, LoginPage } = require('../pages')

describe('Registration', () => {
  const regpage = new RegistrationPage()
  const loginpage = new LoginPage()

  before(() => cy.task('seedTestData'))
  beforeEach(() => regpage.visit())

  it('has correct form fields', () => {
    regpage.assertPageActive()
    regpage.email().should('have.focus')
    regpage.email().should('have.attr', 'type', 'email')
      .should('have.attr', 'placeholder', 'Email')
    regpage.password().should('have.attr', 'type', 'password')
      .should('have.attr', 'placeholder', 'Password')
    regpage.confirmation().should('have.attr', 'type', 'password')
      .should('have.attr', 'placeholder', 'Confirmation')
  })

  it('successful', () => {
    regpage.register('hello@you.com', 'helloyou')
    regpage.registerButton().click()
    loginpage.assertPageActive()
    loginpage.message().contains('congratulations')
  })

  it('duplicate email', () => {
    const duplicate = 'duplicate@you.com'
    regpage.register(duplicate, 'abcdefgh').registerButton().click()
    loginpage.assertPageActive()
    regpage.visit()
    regpage.register(duplicate, 'abcdefgh').registerButton().click()
    regpage.errorMsg().contains(/^duplicate name.*/)
  })

  it('password too short, keeps email in field', () => {
    const email = 'password.too@short.com'
    regpage.register(email, '1234567').registerButton().click()
    regpage.assertPageActive()
    regpage.errorMsg().contains(/^password invalid.*/)
    regpage.email().should('have.attr', 'value', email)
  })
})
