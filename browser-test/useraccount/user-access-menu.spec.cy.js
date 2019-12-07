
const { RegistrationPage, LoginPage, HomePage, BalancePage, MenuBar } = require('../page-objects')

describe('Menu bar', () => {
  const homepage = new HomePage()
  const balancepage = new BalancePage()
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
      menubar.assertItems(['Home', 'Balances', user.email])
      menubar.clickHome()
      homepage.assertPageActive()
      menubar.clickBalances()
      balancepage.assertPageActive()
    })
  )
})
