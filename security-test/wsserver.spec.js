const should = require('chai').should()
const { randomString, errors, wsmessages } = require('../utils')

const { WSServer } = require('../security')
const WSClientInterceptor = require('./interceptor/wsclient-interceptor')

describe('Websocket Server', () => {
  const defServerData = { expected: {}, resolve: true, response: {}, err: null }
  let currentServerData = defServerData
  const resetServerData = () => { currentServerData = Object.assign({}, defServerData) }

  class ExampleWSServer extends WSServer {
    received (req) {
      try {
        req.should.deep.equal(currentServerData.expected)
        return currentServerData.resolve
          ? Promise.resolve(currentServerData.response)
          : Promise.reject(currentServerData.response)
      } catch (err) {
        currentServerData.err = err
        throw err
      }
    }
  }

  const port = 12001
  const path = '/wsserver-test'
  const testToken = 'wsserver-testing-token'

  const authorizedTokens = [testToken, 'another-testing-token', 'one-more-testing-token']
  const wsserverConfig = { port, path, authorizedTokens }
  const wsserver = new ExampleWSServer(wsserverConfig)

  beforeEach(resetServerData)
  afterEach(() => {
    if (currentServerData.err) {
      throw currentServerData.err
    }
  })

  describe('connection handling', () => {
    const clientMock = new WSClientInterceptor(port, path, testToken)

    before(() => wsserver.start())
    after(() => wsserver.stop())
    afterEach(() => serverContinuesOperation().then(() => clientMock.close()))

    const serverContinuesOperation = () => {
      resetServerData()
      currentServerData.expected = { continue: true }
      currentServerData.response = { yes: 'ican' }
      const sendResponseCycle = () => clientMock.connect()
        .then(() => clientMock.send(currentServerData.expected))
        .then(res => res.should.deep.equal(currentServerData.response))

      return clientMock.isOpen()
        ? clientMock.close().then(sendResponseCycle)
        : sendResponseCycle()
    }

    describe('connection handling', () => {
      const expectSocketHangup = wssConfigOverride => clientMock.connect(wssConfigOverride)
        .then(() => { throw new Error('expected websocket to close') })
        .catch(err => {
          clientMock.isOpen().should.equal(false, 'socket closed')
          err.message.should.equal('socket hang up')
        })
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

      it('when incorrect path', () => expectSocketHangup({ path: wsserverConfig.path + 'x' }))

      it('when payload too large', () => expectSocketClosed({ action: randomString(4 * 1024) }))

      it('when sender closes socket immediately', () => {
        clientMock.interceptors.afterSendAction = ws => ws.close()
        currentServerData.expected = { msg: 1 }
        currentServerData.response = { res: 'socket closes immediately' }
        return expectSocketClosed(currentServerData.expected)
      })
    })

    describe('service implementation error', () => {
      beforeEach(() => clientMock.connect())
      afterEach(serverContinuesOperation)

      const expectErrorResponse = (
        { id, expectSocketOpen = true, customResponse = null, ErrorClass = errors.ClientError }
      ) => {
        const request = { implerror: id }
        currentServerData.resolve = false
        currentServerData.expected = request
        currentServerData.response = new ErrorClass(`wss impl error test ${id}`, customResponse, expectSocketOpen)
        return clientMock.send(currentServerData.expected)
          .then(result => {
            result.should.deep.equal(customResponse || wsmessages.error(request))
            clientMock.isOpen().should.equal(expectSocketOpen, 'unexpected socket state')
          })
      }

      it('non-fatal client error', () => expectErrorResponse({ id: 1, expectSocketOpen: true }))

      it('fatal client error', () => expectErrorResponse({ id: 2, expectSocketOpen: false }))

      it('non-fatal client error with specific response', () => expectErrorResponse(
        { id: 3, expectSocketOpen: true, customResponse: { clienterror: 'custom response 1' } }
      ))

      it('fatal client error with specific response', () => expectErrorResponse(
        { id: 4, expectSocketOpen: false, customResponse: { clienterror: 'custom response 1' } }
      ))

      it('generic error', () => expectErrorResponse({ id: 5, expectSocketOpen: false, ErrorClass: Error }))
    })
  })

  describe('server configuration/usage error', () => {
    it('when already running', () => wsserver.start()
      .then(() => wsserver.start())
      .then(() => { throw new Error('expected start error') })
      .catch(err => err.message.should.equal(`failed to listen on port ${wsserverConfig.port}`))
      .finally(() => wsserver.stop())
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
        new WSServer(errconfig).start()
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
})
