const ATestPage = require('./apage')

class RegistrationPage extends ATestPage {
  constructor () {
    super('/register', 'registration')
  }

  email () { return cy.get('input#email') }
  password () { return cy.get('input#password') }
  confirmation () { return cy.get('input#confirmation') }
  registerButton () { return cy.get('button#register') }
  errorMsg () { return cy.get('#error') }
  register (emailText, passwordText, confirmationText = passwordText) {
    this.email().type(emailText)
    this.password().type(passwordText)
    this.confirmation().type(confirmationText)
    return this
  }
}

module.exports = RegistrationPage
