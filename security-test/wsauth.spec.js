const should = require('chai').should()
const { randomString, errors } = require('../utils')

const { WSAuth } = require('../security')
const WSClientMock = require('./wsclientMock')

describe('WebsocketServer authorization', () => {
  const port = 12001
  const path = '/wsauth-test'
  const testToken = 'wsauth-testing-token'

  const authorizedTokens = [testToken, 'another-testing-token', 'one-more-testing-token']
  const wsauthConfig = { port, path, authorizedTokens }
  const wsauth = new WSAuth(wsauthConfig)

  describe('connection handling', () => {
    const serverReceived = []
    wsauth.received = request => {
      serverReceived.push(request)
      return Promise.resolve(request)
    }
    const clientMock = new WSClientMock(port, path, testToken)

    before(() => wsauth.start())
    after(() => wsauth.stop())
    afterEach(() => clientMock.close())

    const expectSocketHangup = wssConfigOverride => clientMock.connect(wssConfigOverride)
      .then(() => { throw new Error('expected websocket to close') })
      .catch(err => err.message.should.equal('socket hang up'))
      .finally(() => clientMock.resetInterceptors())

    const expectSocketClosed = request => clientMock.connect()
      .then(() => clientMock.send(request))
      .then(() => clientMock.isOpen().should.equal(false, 'socket closed'))
      .finally(() => clientMock.resetInterceptors())

    it('allows correct access token', () => clientMock.connect()
      .then(() => clientMock.isOpen().should.equal(true, 'socket open'))
    )

    it('when no access token', () => {
      clientMock.interceptors.headers = {}
      return expectSocketHangup()
    })

    it('when invalid token', () => {
      clientMock.interceptors.headers = { 'X-AUTH-TOKEN': testToken + 'x' }
      return expectSocketHangup()
    })

    it('when incorrect path', () => expectSocketHangup({ path: wsauthConfig.path + 'x' }))

    it('when payload too large', () => expectSocketClosed({ action: randomString(4 * 1024) }))

    it('when sender closes socket immediately', () => {
      clientMock.interceptors.afterSendAction = ws => ws.close()
      return expectSocketClosed({ msg: 1 })
    })
  })

  describe('server configuration/usage error', () => {
    it('when already running', () => wsauth.start()
      .then(() => wsauth.start())
      .then(() => { throw new Error('expected start error') })
      .catch(err => err.message.should.equal(`failed to listen on port ${wsauthConfig.port}`))
      .finally(() => wsauth.stop())
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
      configWith({ authorizedTokens: ['abcdefghijklmnopqrst', 3] }, '"authorizedTokens[1]" must be a string'))
  })

  xdescribe('service implementation error', () => {
    const clientMock = new WSClientMock(port, path, testToken)
    class FailingWSAuth extends WSAuth {
      constructor (config) {
        super(config)
        this.testError = null
      }

      received (req) {
        return this.testError
          ? Promise.reject(this.testError)
          : super.received(req)
      }
    }

    const request = { action: 'test' }
    const failingWSAuth = new FailingWSAuth(wsauthConfig)

    before(() => failingWSAuth.start())
    after(() => failingWSAuth.stop())
    beforeEach(() => clientMock.connect())
    afterEach(() => clientMock.close())

    const expectErrorResultWhen = (
      { message = 'expected test-error', responseObj = null, fatal = false, socketOpen } = {}
    ) => {
      failingWSAuth.testError = new errors.ClientError(message, responseObj, fatal)
      return clientMock.send(request)
        .then(result => {
          result.status.should.equal('error')
          responseObj
            ? result.message.should.deep.equal(responseObj)
            : result.message.should.deep.equal(request)
          clientMock.isOpen().should.equal(socketOpen)
        })
    }

    it('standard error should cause error message', () => expectErrorResultWhen({ socketOpen: true }))
    it('fatal error should cause error message + connection close', () => expectErrorResultWhen(
      { fatal: true, socketOpen: false }
    ))

    it('standard error with specific response', () => expectErrorResultWhen({
      responseObj: { you: 'diditwrong' }, socketOpen: true
    }))
    it('fatal error with specific response', () => expectErrorResultWhen({
      responseObj: { you: 'diditwrong' }, fatal: true, socketOpen: true
    }))
  })
})
