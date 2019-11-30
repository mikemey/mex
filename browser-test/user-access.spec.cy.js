
const RegistrationPage = () => {
  const defaultEmail = 'hello@you.com'
  const defaultPassword = 'helloyou'

  const visit = () => cy.visit('/register')
  const email = () => cy.get('input#email')
  const password = () => cy.get('input#password')
  const confirmation = () => cy.get('input#confirmation')
  const registerButton = () => cy.get('button#register')
  const errorMsg = () => cy.get('#error')
  const register = ({ emailText = defaultEmail, passwordText = defaultPassword, confirmationText = defaultPassword }) => {
    email().type(emailText)
    password().type(passwordText)
    confirmation().type(confirmationText)
    return self
  }

  const self = { visit, email, password, confirmation, registerButton, errorMsg, register }
  return self
}

describe('Registration', () => {
  const regpage = RegistrationPage()
  const testEmail = 'hello@you.com'
  const testPassword = 'helloyou'

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
    // messageText().should('equal', 'congrats!')
  })

  it('duplicate email', () => {
    const duplicate = testEmail + 'x'
    regpage.register(duplicate, testPassword).registerButton().click()
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
