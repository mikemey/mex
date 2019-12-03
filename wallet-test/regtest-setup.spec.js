const RegtestSetup = require('./regtest.orch')

describe.only('A unit test', () => {
  const regtest = RegtestSetup()

  before(function (done) {
    this.timeout(30000)
    regtest.start().then(done)
  })
  after(() => regtest.stop())

  it('does the right thing', () => regtest.getBalance()
    .then(balance => {
      console.log('the balance is:', balance)
    }))
})
