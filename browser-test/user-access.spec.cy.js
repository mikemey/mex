
const { RegistrationPage, LoginPage } = require('./pages')

describe('Registration', () => {
  const regpage = RegistrationPage()
  const loginpage = LoginPage()

  before(() => cy.dropDatabase())
  beforeEach(regpage.visit)

  it('has correct form fields', () => {
    regpage.isCurrentPage()
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
    loginpage.isCurrentPage()
    loginpage.message().contains('congratulations')
  })

  it('duplicate email', () => {
    const duplicate = 'duplicate@you.com'
    regpage.register(duplicate, 'abcdefgh').registerButton().click()
    loginpage.isCurrentPage()
    regpage.visit()
    regpage.register(duplicate, 'abcdefgh').registerButton().click()
    regpage.errorMsg().contains(/^duplicate name.*/)
  })

  it('password too short, keeps email in field', () => {
    const email = 'password.too@short.com'
    regpage.register(email, '1234567').registerButton().click()
    regpage.isCurrentPage()
    regpage.errorMsg().contains(/^password invalid.*/)
    regpage.email().should('have.attr', 'value', email)
  })
})
