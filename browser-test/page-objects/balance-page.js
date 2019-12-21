const ATestPage = require('./apage')

class BalancePage extends ATestPage {
  constructor () {
    super('/balance', 'balances')
  }

  assetBalance (symbol) { return cy.get(`td[data-balance="${symbol}"]`) }

  depositButton (symbol) { return cy.get(`a[data-deposit="${symbol}"]`) }
}

module.exports = BalancePage
