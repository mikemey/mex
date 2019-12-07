
const { BalancePage } = require('../page-objects')

describe('Balance page', () => {
  const balancepage = new BalancePage()

  before(() => cy.task('seedTestData'))

  it('for authenticated users', () => cy.loginRegisteredUser()
    .then(() => {
      balancepage.visit()
      balancepage.assetBalance('btc').should('have.text', '0.00000000')
      balancepage.assetBalance('eth').should('have.text', '0.00000000')
    })
  )
})
