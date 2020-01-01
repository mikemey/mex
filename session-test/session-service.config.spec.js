const SessionService = require('../session')

describe('SessionService configuration', () => {
  const testToken = 'c2Vzc2lvbi1jb25maWcK'
  const port = 12022
  const path = '/session-registration'

  const expectConfigError = (update, message) => {
    const config = {
      jwtkey: 'SmFzb24gTWVuZG96YQo=',
      wsserver: { port, path, authTokens: [testToken] },
      db: { url: 'mongodb://this.shouldn.t/matter', name: 'so wont this' }
    }
    update(config)
    assertConfigError(config, message)
  }

  const assertConfigError = (errconfig, expectedMessage) =>
    (() => new SessionService(errconfig)).should.throw(Error, expectedMessage)

  const testParameters = [
    { title: 'missing jwtkey configuration', changeConfig: cfg => delete cfg.jwtkey, error: '"jwtkey" is required' },
    { title: 'jwtkey not base64 encoded', changeConfig: cfg => { cfg.jwtkey = '^^1234567890123456^^' }, error: '"jwtkey" must be a valid base64 string' },
    { title: 'jwtkey too short', changeConfig: cfg => { cfg.jwtkey = '1234567890123456789' }, error: '"jwtkey" too short' },
    { title: 'missing db configuration', changeConfig: cfg => delete cfg.db, error: '"db" is required' },
    { title: 'missing db.url configuration', changeConfig: cfg => delete cfg.db.url, error: '"db.url" is required' },
    { title: 'missing db.name configuration', changeConfig: cfg => delete cfg.db.name, error: '"db.name" is required' },
    { title: 'missing wsserver configuration', changeConfig: cfg => delete cfg.wsserver, error: '"wsserver" is required' }
  ]

  testParameters.forEach(params => {
    it(params.title, () => expectConfigError(params.changeConfig, params.error))
  })
})
