
const LoginPage = () => {
  const visit = () => cy.visit('/login')
  const email = () => cy.get('input#email')
  const password = () => cy.get('input#password')
  const loginButton = () => cy.get('button#login')
  const message = () => cy.get('#message')
  const login = (emailText, passwordText) => {
    email().type(emailText)
    password().type(passwordText)
    return self
  }

  const self = { visit, email, password, loginButton, message, login }
  return self
}

module.exports = LoginPage
