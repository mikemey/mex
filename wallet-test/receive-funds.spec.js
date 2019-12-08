const BitcoinClient = require('bitcoin-core')

const { startServices, stopServices, wsClient, withJwt } = require('./wallet.orch')
const { walletConfig } = require('./btcnode.orch')
const { wsmessages: { withAction, OK_STATUS } } = require('../utils')

describe('Receiving funds', () => {
  before(startServices)
  after(stopServices)
  afterEach(() => wsClient.stop())

  it('generate new address', async () => {
    const newAddressRequest = withJwt(withAction('address').build({ id: 'test-user-id', symbol: 'btc' }))
    const newAddressResponse = await wsClient.send(newAddressRequest)

    newAddressResponse.status.should.equal(OK_STATUS)
    newAddressResponse.action.should.equal('address')

    const mexWallet = new BitcoinClient(walletConfig())
    const addressInfo = await mexWallet.getAddressInfo(newAddressResponse.address)
    addressInfo.ismine.should.equal(true)
  })
})
