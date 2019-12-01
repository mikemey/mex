const { SessionService } = require('../session')

describe('SessionService configuration', () => {
  const testToken = 'c2Vzc2lvbi1jb25maWcK'
  const port = 12022
  const path = '/session-registration'

  const expectConfigError = (update, message) => {
    const config = {
      wsserver: { port, path, authorizedTokens: [testToken] },
      db: { url: 'mongodb://this.shouldn.t/matter', name: 'mex-test' }
    }
    update(config)
    assertConfigError(config, message)
  }

  const assertConfigError = (errconfig, expectedMessage) =>
    (() => new SessionService(errconfig)).should.throw(Error, expectedMessage)

  const testParameters = [
    { title: 'missing db configuration', changeConfig: cfg => delete cfg.db, error: '"db" is required' },
    { title: 'missing db.url configuration', changeConfig: cfg => delete cfg.db.url, error: '"db.url" is required' },
    { title: 'missing db.name configuration', changeConfig: cfg => delete cfg.db.name, error: '"db.name" is required' },
    { title: 'missing wsserver configuration', changeConfig: cfg => delete cfg.wsserver, error: '"wsserver" is required' }
  ]

  testParameters.forEach(params => {
    it(params.title, () => expectConfigError(params.changeConfig, params.error))
  })
})
