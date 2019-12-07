const { startServices, stopServices } = require('./wallet.orch')
const { faucetWallet } = require('./btcnode.orch')

describe('Regtest node setup', () => {
  before(startServices)
  after(stopServices)

  it('faucet has balance', async () => {
    const balance = await faucetWallet.getBalance()
    balance.should.be.at.least(50)
  })
})
