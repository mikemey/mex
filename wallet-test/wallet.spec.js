const WalletService = require('../wallet')

const { startServices, stopServices, wsClient, withJwtMessages, sessionMock, walletServiceConfig } = require('./wallet.orch')

describe('Wallet service', () => {
  describe('calls session service', () => {
    before(startServices)
    after(stopServices)
    afterEach(() => wsClient.stop())

    it('for get address requests', async () => {
      const newAddressRequest = withJwtMessages('address').build({ symbol: 'btc' })
      const expectedMessage = withJwtMessages('verify').build({})

      await wsClient.send(newAddressRequest)
      sessionMock.assertReceived(expectedMessage)
    })
  })

  describe('configuration check', () => {
    const testParameters = [
      { title: 'missing chains configuration', changeConfig: cfg => delete cfg.chains, error: '"chains" is required' },
      { title: 'missing db configuration', changeConfig: cfg => delete cfg.db, error: '"db" is required' }
    ]

    testParameters.forEach(params => {
      it(params.title, () => {
        const config = Object.assign({}, walletServiceConfig)
        params.changeConfig(config);
        (() => new WalletService(config)).should.throw(Error, params.error)
      })
    })
  })
})
