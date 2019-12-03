
const { RegistrationPage, LoginPage, HomePage, MenuBar } = require('../pages')

describe('Menu bar', () => {
  const homepage = new HomePage()
  const menubar = new MenuBar()
  const regpage = new RegistrationPage()
  const loginpage = new LoginPage()

  before(() => cy.task('seedTestData'))

  it('for unauthenticated user', () => {
    homepage.visit()
    loginpage.assertPageActive()
    menubar.assertItems(['Login', 'Register'])

    menubar.clickRegister()
    regpage.assertPageActive()
    menubar.assertItems(['Login', 'Register'])

    menubar.clickLogin()
    loginpage.assertPageActive()
  })

  it('for authenticated users', () => cy.loginRegisteredUser()
    .then(user => {
      menubar.assertItems(['Home', user.email])
      menubar.clickHome()
      homepage.assertPageActive()
    })
  )
})
