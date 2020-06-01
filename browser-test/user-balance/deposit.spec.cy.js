
const { BalancePage, DepositPage } = require('../page-objects')

describe('Deposit page', () => {
  const balancepage = new BalancePage()
  const depositBtcPage = new DepositPage('btc')

  before(() => cy.task('seedTestData'))

  it('deposit address stays same', () => cy.loginRegisteredUser()
    .then(() => {
      balancepage.visit()
      balancepage.depositButton('btc').click()
      return depositBtcPage.getDepositAddressSpan()
    })
    .then(depositAddressElmt => {
      const depositAddress = depositAddressElmt.text()
      depositBtcPage.getDepositAddressSpan().contains(depositAddress)
    })
  )

  it('show invoices for registered user', () => cy.loginRegisteredUser()
    .then(() => {
      balancepage.visit()
      balancepage.depositButton('btc').click()
      depositBtcPage.assertPageActive()
      depositBtcPage.invoiceCount().should('have.length', 3)
      depositBtcPage.assertInvoice('47a307cfafab57381a8eb7a740efd35370c5212cfd404a8c8d41c2d9d63c92a7',
        'Thursday, December 19, 2019 3:59 PM', '3.40000000', 'unconfirmed')
      depositBtcPage.assertInvoice('12bc96ecda588deecd3b37fdcbaf4aff6518b57b988a4e8c05365409c3c59f24',
        'Thursday, December 19, 2019 2:19 PM', '0.12345000', 3)
      depositBtcPage.assertInvoice('c27712bb0c607336d5625bf2196ddab0217c9f1bd77fa68fc1c00f75067e8535',
        'Thursday, December 19, 2019 1:59 PM', '0.67891000', 2)

      depositBtcPage.assertInvoiceLinks('47a307cfafab57381a8eb7a740efd35370c5212cfd404a8c8d41c2d9d63c92a7',
        null,
        'https://live.blockcypher.com/btc-testnet/tx/47a307cfafab57381a8eb7a740efd35370c5212cfd404a8c8d41c2d9d63c92a7/')
      depositBtcPage.assertInvoiceLinks('12bc96ecda588deecd3b37fdcbaf4aff6518b57b988a4e8c05365409c3c59f24',
        'https://live.blockcypher.com/btc-testnet/block/3/',
        'https://live.blockcypher.com/btc-testnet/tx/12bc96ecda588deecd3b37fdcbaf4aff6518b57b988a4e8c05365409c3c59f24/')
      depositBtcPage.assertInvoiceLinks('c27712bb0c607336d5625bf2196ddab0217c9f1bd77fa68fc1c00f75067e8535',
        'https://live.blockcypher.com/btc-testnet/block/2/',
        'https://live.blockcypher.com/btc-testnet/tx/c27712bb0c607336d5625bf2196ddab0217c9f1bd77fa68fc1c00f75067e8535/')
      cy.go('back')
      balancepage.assertPageActive()
    })
  )

  it('update live invoice', () => {
    let newTransactionId
    return cy.loginRegisteredUser()
      .then(() => {
        depositBtcPage.visit()
        depositBtcPage.assertPageActive()
        depositBtcPage.invoiceCount(3)
        return depositBtcPage.getDepositAddressSpan()
      })
      .then(addrElmt => cy.sendToAddress(addrElmt.text(), '1.987'))
      .then(txid => {
        newTransactionId = txid
        depositBtcPage.invoiceCount().should('have.length', 4)
        depositBtcPage.assertInvoice(newTransactionId, null, '1.98700000', 'unconfirmed')
        depositBtcPage.assertInvoiceLinks(newTransactionId, null,
          `https://live.blockcypher.com/btc-testnet/tx/${newTransactionId}/`)

        return cy.generateUnrelatedTxs()
      })
      .then(() => cy.generateBlocksWithInfo(1))
      .then(blocks => {
        const blockHeight = blocks[0].height
        depositBtcPage.invoiceCount().should('have.length', 4)
        depositBtcPage.assertInvoice(newTransactionId, null, '1.98700000', blockHeight)

        depositBtcPage.assertInvoiceLinks(newTransactionId,
          `https://live.blockcypher.com/btc-testnet/block/${blockHeight}/`,
          `https://live.blockcypher.com/btc-testnet/tx/${newTransactionId}/`
        )
      })
  })
})
