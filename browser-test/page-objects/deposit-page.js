const ATestPage = require('./apage')

class DepositPage extends ATestPage {
  constructor (symbol) {
    super(`/balance/deposit/${symbol}`, `${symbol} deposits`)
    this.symbol = symbol
  }

  getDepositAddress () { return cy.get(`[data-address="${this.symbol}"]`) }

  assertInvoice (date, amount, block, invoiceId) {
    const invoiceItem = ix => cy.get(`tr[data-invoice=${invoiceId}] td:nth-child(${ix})`)
    invoiceItem(1).should('have.text', date)
    invoiceItem(2).should('have.text', amount)
    invoiceItem(3).should('have.text', block)
    invoiceItem(4).should('have.text', invoiceId)
  }
}

module.exports = DepositPage
