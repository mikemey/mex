const WalletService = require('../wallet')

describe('Wallet service', () => {
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
