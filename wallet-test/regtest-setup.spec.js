const RegtestSetup = require('./regtest.orch')

describe('First regtest', () => {
  const regtest = RegtestSetup()

  before(regtest.start)
  after(regtest.stop)

  it('faucet balance', () => regtest.getFaucetBalance()
    .then(balance => balance.should.be.at.least(50))
  )
})
