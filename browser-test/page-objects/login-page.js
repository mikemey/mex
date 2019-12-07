const ATestPage = require('./apage')

class LoginPage extends ATestPage {
  constructor () {
    super('/access/login', 'login')
  }

  email () { return cy.get('input#email') }
  password () { return cy.get('input#password') }
  loginButton () { return cy.get('button#login') }
  message () { return cy.get('#message') }
  errorMsg () { return cy.get('#error') }
  login (emailText, passwordText) {
    this.email().clear().type(emailText)
    this.password().type(passwordText)
    this.loginButton().click()
  }
}

module.exports = LoginPage
