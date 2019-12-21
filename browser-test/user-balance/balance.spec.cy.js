
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

  describe('deposits', () => {
    it('deposit address stays same', () => cy.loginRegisteredUser()
      .then(() => {
        balancepage.visit()
        balancepage.depositButton('btc').click()
        return depositBtcPage.getDepositAddress()
      })
      .then(depositAddressElmt => {
        const depositAddress = depositAddressElmt.text()
        depositBtcPage.getDepositAddress().contains(depositAddress)
      })
    )

    it('show invoices for registered user', () => cy.loginRegisteredUser()
      .then(() => {
        balancepage.visit()
        balancepage.depositButton('btc').click()
        depositBtcPage.assertPageActive()
        depositBtcPage.assertInvoice('Thursday, December 19, 2019 3:59 PM', '3.40000000', 'unconfirmed',
          '47a307cfafab57381a8eb7a740efd35370c5212cfd404a8c8d41c2d9d63c92a7')
        depositBtcPage.assertInvoice('Thursday, December 19, 2019 2:19 PM', '0.12345000', '609122',
          '12bc96ecda588deecd3b37fdcbaf4aff6518b57b988a4e8c05365409c3c59f24')
        depositBtcPage.assertInvoice('Thursday, December 19, 2019 1:59 PM', '0.67891000', '609120',
          'c27712bb0c607336d5625bf2196ddab0217c9f1bd77fa68fc1c00f75067e8535')

        cy.go('back')
        balancepage.assertPageActive()
      })
    )
  })
})
