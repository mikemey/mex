const { BalancePage, DepositPage } = require('../page-objects')

describe('Balance page', () => {
  const balancepage = new BalancePage()
  const depositBtcPage = new DepositPage('btc')

  before(() => cy.task('seedTestData'))

  it('no balance for new user', () => cy.registerAndLoginUser('balance-page@test.com')
    .then(() => {
      balancepage.visit()
      balancepage.assetBalance('btc').should('have.text', '0.00000000')
      balancepage.assetBalance('eth').should('have.text', '0.000000')
    })
  )

  it('balance for registered user', () => cy.loginRegisteredUser()
    .then(() => {
      balancepage.visit()
      balancepage.assetBalance('btc').should('have.text', '1.23400000')
      balancepage.assetBalance('eth').should('have.text', '0.000012')
    })
  )

  it('settle deposit invoices for registered user', () => {
    let address = null
    return cy.loginRegisteredUser()
      .then(() => {
        balancepage.visit()
        balancepage.assetBalance('btc').should('have.text', '1.23400000')
        balancepage.assetBalance('eth').should('have.text', '0.000012')
        balancepage.depositButton('btc').click()
        depositBtcPage.assertPageActive()
        return depositBtcPage.getDepositAddressSpan()
      })
      .then(addrElmt => { address = addrElmt.text() })
      .then(() => cy.sendToAddress(address, '0.666'))
      .then(() => cy.sendToAddress(address, '0.1'))
      .then(() => cy.generateBlocksWithInfo(1))
      .then(() => {
        balancepage.visit()
        balancepage.assetBalance('btc').should('have.text', '2.00000000')
      })
  })
})
