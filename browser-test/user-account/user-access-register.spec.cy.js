
const { RegistrationPage, LoginPage } = require('../page-objects')

describe('Registration', () => {
  const regpage = new RegistrationPage()
  const loginpage = new LoginPage()

  before(() => cy.task('dropTestDatabase'))
  beforeEach(() => regpage.visit())

  it('has correct form fields', () => {
    regpage.assertPageActive()
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
    loginpage.message().contains('Congratulations')
  })

  it('duplicate email', () => {
    const duplicate = 'duplicate@you.com'
    regpage.register(duplicate, 'abcdefgh').registerButton().click()
    loginpage.assertPageActive()
    regpage.visit()
    regpage.register(duplicate, 'abcdefgh').registerButton().click()
    regpage.errorMsg().contains(/^duplicate email.*/)
  })

  it('password + confirmation mismatch', () => {
    regpage.register('hello@you.com', 'zyxwvuts', 'abcdefgh').registerButton().click()
    regpage.assertPageActive()
    regpage.errorMsg().contains('password and confirmation not matching')
  })

  it('password too short, keeps email in field', () => {
    const email = 'password.too@short.com'
    regpage.register(email, '1234567').registerButton().click()
    regpage.assertPageActive()
    regpage.errorMsg().contains(/^password invalid.*/)
    regpage.email().should('have.attr', 'value', email)
  })
})
