const { faucetWallet } = require('./btc-regtest.orch')

describe('Regtest node setup', () => {
  it('faucet has balance', async () => {
    const balance = await faucetWallet.getBalance()
    balance.should.be.at.least(50)
  })
})
