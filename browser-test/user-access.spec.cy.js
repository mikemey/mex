
const { RegistrationPage, LoginPage } = require('./pages')

describe('Registration', () => {
  const testEmail = 'hello@you.com'
  const testPassword = 'helloyou'
  const regpage = RegistrationPage()
  const loginpage = LoginPage()

  before(() => cy.dropDatabase())
  beforeEach(regpage.visit)

  it('has correct form fields', () => {
    cy.title().should('equal', 'mex registration')
    regpage.email().should('have.focus')
    regpage.email().should('have.attr', 'type', 'email')
      .should('have.attr', 'placeholder', 'Email')
    regpage.password().should('have.attr', 'type', 'password')
      .should('have.attr', 'placeholder', 'Password')
    regpage.confirmation().should('have.attr', 'type', 'password')
      .should('have.attr', 'placeholder', 'Confirmation')
  })

  it('successful', () => {
    regpage.register(testEmail, testPassword)
    regpage.registerButton().click()
    cy.title().should('equal', 'mex login')
    loginpage.message().contains('congratulation')
  })

  it('duplicate email', () => {
    const duplicate = 'x' + testEmail
    regpage.register(duplicate, testPassword).registerButton().click()
    cy.title().should('equal', 'mex login')
    regpage.visit()
    regpage.register(duplicate, testPassword).registerButton().click()
    regpage.errorMsg().contains(/^duplicate name.*/)
  })

  it('password too short', () => {
    // regpage.register(duplicate, testPassword).registerButton().click()
    // regpage.visit()
    // regpage.register(duplicate, testPassword).registerButton().click()
    // regpage.errorMsg().should('match', /^duplicate name.*/)
  })

  // it('keeps email after input error', () => {
  //   .should('have.value', 'fake@email.com')
  //   throw new Error('implement')
  // })
})
