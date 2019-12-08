const BitcoinClient = require('bitcoin-core')

const { startServices, stopServices, wsClient, testJwt } = require('./wallet.orch')
const { walletConfig } = require('./btcnode.orch')
const { wsmessages: { withAction, OK_STATUS } } = require('../utils')

const addressMessages = withAction('address')

describe('Receiving funds', () => {
  before(startServices)
  after(stopServices)
  afterEach(() => wsClient.stop())

  it('generate new address', async () => {
    const newAddressRequest = addressMessages.build({ id: 'test-user-id?', jwt: testJwt, symbol: 'btc' })
    const newAddressResponse = await wsClient.send(newAddressRequest)

    newAddressResponse.status.should.equal(OK_STATUS)
    newAddressResponse.action.should.equal('address')

    const mexWallet = new BitcoinClient(walletConfig())
    const addressInfo = await mexWallet.getAddressInfo(newAddressResponse.address)
    addressInfo.ismine.should.equal(true)
  })

  xit('configuration: invalid wallet', () => { })
  xit('configuration: missing btcClient', () => { })
})
