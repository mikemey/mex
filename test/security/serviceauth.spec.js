const TestClient = require('../testClient')

const ServiceAuth = require('../../src/security/serviceauth')

describe('Service authorization', () => {
  const testClient = new TestClient()
  const svcConfig = testClient.config.wss
  const serviceauth = new ServiceAuth(svcConfig)
  before(() => serviceauth.start())
  after(() => serviceauth.stop())

  describe('should allow WS connection', () => {
    it('when correct access token', () => testClient.connect())
  })

  describe('should disallow WS connection', () => {
    const expectSocketHangup = (headers, path) => testClient.connect(headers, path)
      .then(() => { throw new Error('expected websocket to close') })
      .catch(err => {
        err.message.should.equal('socket hang up')
      })

    it('when no access token', () => expectSocketHangup({}))
    it('when no invalid token', () => expectSocketHangup(
      { 'X-AUTH-TOKEN': svcConfig.authorizedKeys[0] + 'x' }
    ))
    it('when incorrect path', () => expectSocketHangup(undefined, svcConfig.path + 'x'))
  })

  describe('service start error', () => {
    it('when already running', () => serviceauth.start()
      .then(() => { throw new Error('expected error') })
      .catch(err => {
        err.message.should.equal(`already started on port ${svcConfig.port}`)
      })
    )
  })
})
