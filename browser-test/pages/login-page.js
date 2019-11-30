const ATestPage = require('./apage')

class LoginPage extends ATestPage {
  constructor () {
    super('/login', 'login')
  }

  email () { return cy.get('input#email') }
  password () { return cy.get('input#password') }
  loginButton () { return cy.get('button#login') }
  message () { return cy.get('#message') }
  login (emailText, passwordText) {
    this.email().type(emailText)
    this.password().type(passwordText)
    return this
  }
}

module.exports = LoginPage
