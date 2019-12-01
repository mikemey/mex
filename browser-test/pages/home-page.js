const ATestPage = require('./apage')

class HomePage extends ATestPage {
  constructor () {
    super('/index', 'home')
  }
}

module.exports = HomePage
