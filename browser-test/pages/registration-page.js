
const RegistrationPage = () => {
  const visit = () => cy.visit('/register')
  const email = () => cy.get('input#email')
  const password = () => cy.get('input#password')
  const confirmation = () => cy.get('input#confirmation')
  const registerButton = () => cy.get('button#register')
  const errorMsg = () => cy.get('#error')
  const register = (emailText, passwordText, confirmationText = passwordText) => {
    email().type(emailText)
    password().type(passwordText)
    confirmation().type(confirmationText)
    return self
  }

  const self = { visit, email, password, confirmation, registerButton, errorMsg, register }
  return self
}

module.exports = RegistrationPage
