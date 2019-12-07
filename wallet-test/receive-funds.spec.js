const BitcoinClient = require('bitcoin-core')

const { startServices, stopServices, wsClient, testJwt } = require('./wallet.orch')
const { mainWalletConfig } = require('./btcnode.orch')
const { wsmessages: { withAction, OK_STATUS } } = require('../utils')

const addressMessages = withAction('newaddress')

describe('Receiving funds', () => {
  before(startServices)
  after(stopServices)
  afterEach(() => wsClient.stop())

  it('generate new address', async () => {
    const newAddressRequest = addressMessages.build({ jwt: testJwt })
    const newAddressResponse = await wsClient.send(newAddressRequest)

    newAddressResponse.status.should.equal(OK_STATUS)
    newAddressResponse.action.should.equal('newaddress')

    const mexWallet = new BitcoinClient(mainWalletConfig())
    const addressInfo = await mexWallet.getAddressInfo(newAddressResponse.address)
    addressInfo.ismine.should.equal(true)
  })

  xit('configuration: invalid wallet', () => { })
  xit('configuration: missing btcClient', () => { })
})
