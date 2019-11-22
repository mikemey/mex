const { TestClient, trand } = require('../testtools')

const { WSAuth } = require('../security')

describe('Websocket authorization', () => {
  const testClient = new TestClient()
  const svcConfig = testClient.wssconfig
  const wsauth = new WSAuth(svcConfig)

  before(() => wsauth.start())
  after(() => wsauth.stop())
  afterEach(() => testClient.close())

  describe('should allow WS connection', () => {
    it('when correct access token', () => testClient.connect())
  })

  describe('should close WS connection', () => {
    const expectSocketHangup = (headers, path) => testClient.connect(headers, path)
      .then(() => { throw new Error('expected websocket to close') })
      .catch(err => {
        err.message.should.equal('socket hang up')
      })

    it('when no access token', () => expectSocketHangup({}))

    it('when no invalid token', () => expectSocketHangup(
      { 'X-AUTH-TOKEN': svcConfig.authorizedTokens[0] + 'x' }
    ))

    it('when incorrect path', () => expectSocketHangup(undefined, svcConfig.path + 'x'))

    it('when payload too large', () => {
      const request = { action: trand.randStr(4 * 1024) }
      return testClient.connect()
        .then(() => testClient.send(request))
        .then(() => {
          testClient.isOpen().should.equal(false, 'socket closed')
        })
    })
  })

  describe('server start error', () => {
    it('when already running', () => wsauth.start()
      .then(() => { throw new Error('expected error') })
      .catch(err => {
        err.message.should.equal(`failed to listen on port ${svcConfig.port}`)
      })
    )
  })
})

describe('Service implementation', () => {
  const testClient = new TestClient()
  class FailingService extends WSAuth {
    constructor () {
      super(testClient.wssconfig)
    }

    received (_) {
      return Promise.reject(Error('test-error'))
    }
  }

  const failService = new FailingService()
  before(() => failService.start())
  after(() => failService.stop())
  beforeEach(() => testClient.connect())
  afterEach(() => testClient.close())

  it('processing failure should result in error response', () => {
    const request = { action: 'test' }
    return testClient.send(request)
      .then(result => {
        result.status.should.equal('error')
        result.message.should.deep.equal(request)
      })
  })
})
