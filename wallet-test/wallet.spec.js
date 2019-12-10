const WalletService = require('../wallet')

const { startServices, stopServices, wsClient, withJwtMessages, sessionMock } = require('./wallet.orch')

describe('Wallet service', () => {
  describe('auth check', () => {
    before(startServices)
    after(stopServices)
    afterEach(() => wsClient.stop())

    it('calls session service', async () => {
      const newAddressRequest = withJwtMessages('address').build({ symbol: 'btc' })
      const expectedMessage = withJwtMessages('verify').build({})

      await wsClient.send(newAddressRequest)
      sessionMock.assertReceived(expectedMessage)
    })
  })

  describe('configuration check', () => {
    const testParameters = [
      { title: 'missing btcClient configuration', changeConfig: cfg => delete cfg.btcClient, error: '"btcClient" is required' },
      { title: 'missing db configuration', changeConfig: cfg => delete cfg.db, error: '"db" is required' }
    ]

    testParameters.forEach(params => {
      it(params.title, () => {
        const config = {
          httpserver: { does: 'not-matter' },
          btcClient: { does: 'not-matter' },
          walletService: { does: 'not-matter' },
          db: { does: 'not-matter' }
        }
        params.changeConfig(config);
        (() => new WalletService(config)).should.throw(Error, params.error)
      })
    })
  })
})
