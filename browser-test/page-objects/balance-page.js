const ATestPage = require('./apage')

class BalancePage extends ATestPage {
  constructor () {
    super('/balance', 'balances')
  }

  assetBalance (symbol) { return cy.get(`td[data-balance="${symbol}"]`) }
}

module.exports = BalancePage
