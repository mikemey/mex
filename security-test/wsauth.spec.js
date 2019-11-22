const should = require('chai').should()
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

    const allowedConfig = { path: '/test-123', port: 18000, authorizedTokens: ['a-token'] }
    const configWith = (overwrite, expectedMessage) => {
      const errconfig = Object.assign({}, allowedConfig, overwrite)
      return checkConfigError(errconfig, expectedMessage)
    }

    const configWithout = (deleteField, expectedMessage) => {
      const errconfig = Object.assign({}, allowedConfig)
      delete errconfig[deleteField]
      return checkConfigError(errconfig, expectedMessage)
    }

    const checkConfigError = (errconfig, expectedMessage) => {
      try {
        new WSAuth(errconfig).start()
        should.fail('expected error')
      } catch (err) {
        err.message.should.equal(expectedMessage)
      }
    }

    it('path required', () => configWithout('path', '"path" is required'))
    it('path invalid', () => configWith({ path: '12345678901' }, '"path" not valid'))
    it('port required', () => configWithout('port', '"port" is required'))
    it('port not valid', () => configWith({ port: '70123' }, '"port" must be a valid port'))
    it('authorizedTokens required', () => configWithout('authorizedTokens', '"authorizedTokens" is required'))
    it('authorizedTokens not an array', () => configWith({ authorizedTokens: 'lala' }, '"authorizedTokens" must be an array'))
    it('authorizedTokens contains non-string', () =>
      configWith({ authorizedTokens: ['lala', 3] }, '"authorizedTokens[1]" must be a string'))
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
