const ATestPage = require('./apage')

class DepositPage extends ATestPage {
  constructor (symbol) {
    super(`/balance/deposit/${symbol}`, `${symbol} deposits`)
    this.symbol = symbol
  }

  getDepositAddressSpan () { return cy.get(`[data-address="${this.symbol}"]`) }

  invoiceCount () { return cy.get('tbody#invoices tr:visible') }

  assertInvoice (invoiceId, date, amount, block) {
    const invoiceItem = (ix, subel = '') => cy.get(`tr[data-invoice=${invoiceId}] td:nth-child(${ix}) ${subel}`)
    date && invoiceItem(1).should('have.text', date)
    invoiceItem(2).should('have.text', amount)
    invoiceItem(3, block === 'unconfirmed' ? 'span' : 'a').should('have.text', `${block}`)
    invoiceItem(4).should('have.text', invoiceId)
  }

  assertInvoiceLinks (invoiceId, blockLink, invoiceIdLink) {
    const link = ix => cy.get(`tr[data-invoice=${invoiceId}] td:nth-child(${ix}) a`)
    blockLink
      ? link(3).invoke('attr', 'href').should('eq', blockLink)
      : link(3).should('not.visible')
    link(4).invoke('attr', 'href').should('eq', invoiceIdLink)
  }
}

module.exports = DepositPage
