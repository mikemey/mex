const { WSSecureServer, WSClient } = require('../connectors')
const { WSServerMock } = require('../test-tools')
const { wsmessages: { error, withAction } } = require('../utils')

describe('WSSecureServer', () => {
  const sessionMockToken = 'c2Vzc2lvbi1tb2NrLXRlc3R0b2tlbgo='
  const wsSecureServerToken = 'd3Mtand0LXZlcmlmaWVyLXRlc3R0b2tlbgo='

  const sessionMockConfig = {
    port: 12032, path: '/sessionmock', authorizedTokens: [sessionMockToken]
  }

  const wsSecureServerConfig = {
    port: 12033,
    path: '/jwt-checker',
    authorizedTokens: [wsSecureServerToken],
    sessionService: {
      url: `ws://localhost:${sessionMockConfig.port}${sessionMockConfig.path}`,
      authToken: sessionMockToken,
      timeout: 200
    }
  }

  const userClientConfig = {
    url: `ws://localhost:${wsSecureServerConfig.port}${wsSecureServerConfig.path}`,
    authToken: wsSecureServerToken,
    timeout: 200
  }

  const secureServerResponse = { action: 'testing-response' }
  class WSSecureServerDummyImpl extends WSSecureServer {
    constructor (config) {
      super(config)
      this.reset()
    }

    reset () { this.receivedRequests = [] }

    assertReceived (...requests) {
      this.receivedRequests.should.deep.equal([...requests])
    }

    secureReceived (request) {
      this.receivedRequests.push(request)
      return Promise.resolve(secureServerResponse)
    }
  }

  const sessionServiceMock = new WSServerMock(sessionMockConfig, 'secure session-mock')
  const securedServer = new WSSecureServerDummyImpl(wsSecureServerConfig)
  const userClient = new WSClient(userClientConfig, 'secure-test-client')

  const testJwt = '12345678901234567890'
  const clientRequest = { jwt: testJwt, action: 'client-request' }
  const user = { testId: '123' }
  const implementationRequest = { user, action: 'client-request' }

  const verifyMessages = withAction('verify')
  const verifyRequest = verifyMessages.build({ jwt: testJwt })

  afterEach(() => sessionServiceMock.errorCheck())

  describe('session service running', () => {
    before(() => Promise.all([securedServer.start(), sessionServiceMock.start()]))
    after(() => Promise.all([securedServer.stop(), sessionServiceMock.stop()]))
    beforeEach(() => Promise.all([securedServer.reset(), sessionServiceMock.reset()]))

    it('allows requests when session-service responds OK', async () => {
      const verifyResponse = verifyMessages.ok({ user })

      sessionServiceMock.addMockFor(verifyRequest, verifyResponse)
      const response = await userClient.send(clientRequest)
      response.should.deep.equal(secureServerResponse)
      sessionServiceMock.assertReceived(verifyRequest)
      securedServer.assertReceived(implementationRequest)
    })

    it('rejects requests when session-service responds NOK', async () => {
      sessionServiceMock.addMockFor(verifyRequest, verifyMessages.nok())
      const response = await userClient.send(clientRequest)
      response.should.deep.equal(verifyMessages.nok())
      sessionServiceMock.assertReceived(verifyRequest)
      securedServer.assertReceived()
    })

    it('rejects requests when session-service responds ERROR', async () => {
      sessionServiceMock.addMockFor(verifyRequest, error('invalid request'))
      const response = await userClient.send(clientRequest)
      response.should.deep.equal(error('session-service unavailable'))
      sessionServiceMock.assertReceived(verifyRequest)
      securedServer.assertReceived()
    })

    it('rejects requests when session-service responds without user', async () => {
      const verifyResponse = verifyMessages.ok()
      sessionServiceMock.addMockFor(verifyRequest, verifyResponse)
      const response = await userClient.send(clientRequest)
      response.should.deep.equal(error('session-service user unavailable'))
      sessionServiceMock.assertReceived(verifyRequest)
      securedServer.assertReceived()
    })

    it('when missing jwt field', async () => {
      const invalidClientRequest = Object.assign({}, clientRequest)
      delete invalidClientRequest.jwt
      const response = await userClient.send(invalidClientRequest)
      response.should.deep.equal(error('invalid request'))
      sessionServiceMock.assertReceived()
      securedServer.assertReceived()
    })
  })

  describe('session service down', () => {
    before(() => securedServer.start())
    after(() => securedServer.stop())

    it('rejects requests', async () => {
      const response = await userClient.send(clientRequest)
      response.should.deep.equal(error('session-service unavailable'))
      securedServer.assertReceived()
    })
  })

  describe('fatal implementation errors', () => {
    it('configuration missing "sessionService" parameter', () => {
      const errorConfig = Object.assign({}, wsSecureServerConfig)
      delete errorConfig.sessionService
      return (() => new WSSecureServer(errorConfig))
        .should.throw(Error, '"sessionService" is required')
    })
  })

  describe('forwards errors from .secureReceived', () => {
    let throwingServer

    before(() => {
      sessionServiceMock.addMockFor(verifyRequest, verifyMessages.ok({ user }))
      return sessionServiceMock.start()
    })
    after(() => sessionServiceMock.stop())
    beforeEach(() => { throwingServer = null })
    afterEach(() => throwingServer && throwingServer.stop())

    it('when thrown', async () => {
      class TestImpl extends WSSecureServer {
        secureReceived (_) { throw Error('throw-test-error') }
      }
      throwingServer = new TestImpl(wsSecureServerConfig)

      await throwingServer.start()
      const res = await userClient.send(clientRequest)
      res.should.deep.equal(error(implementationRequest))
    })

    it('when Promise.reject', async () => {
      class TestImpl extends WSSecureServer {
        secureReceived (_) { return Promise.reject(Error('promise-test-error')) }
      }
      throwingServer = new TestImpl(wsSecureServerConfig)

      await throwingServer.start()
      const res = await userClient.send(clientRequest)
      res.should.deep.equal(error(implementationRequest))
    })
  })
})
