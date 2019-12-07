const ATestPage = require('./apage')

class BalancePage extends ATestPage {
  constructor () {
    super('/balance', 'balances')
  }
}

module.exports = BalancePage
