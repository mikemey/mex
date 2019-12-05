const { WSSecureServer } = require('../session')
const { WSClient } = require('../connectors')
const { WSServerMock } = require('../test-tools')
const { wsmessages: { error, withAction, OK_STATUS, NOK_STATUS, ERROR_STATUS } } = require('../utils')

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

  const sessionServiceMock = new WSServerMock(sessionMockConfig)
  const wsSecureServer = new WSSecureServerDummyImpl(wsSecureServerConfig)
  const userClient = new WSClient(userClientConfig)

  const testJwt = 'bladibladibla'
  const clientRequest = { jwt: testJwt, action: 'client-request' }

  const verifyMessage = withAction('verify')
  const verifyRequest = verifyMessage.build({ jwt: testJwt })

  describe('session service running', () => {
    before(() => Promise.all([wsSecureServer.start(), sessionServiceMock.start()]))
    after(() => Promise.all([wsSecureServer.stop(), sessionServiceMock.stop()]))
    beforeEach(() => Promise.all([wsSecureServer.reset(), sessionServiceMock.reset()]))

    it('allows requests when session-service responds OK', async () => {
      sessionServiceMock.addMockFor(verifyRequest, verifyMessage.ok())
      const response = await userClient.send(clientRequest)
      response.should.deep.equal(secureServerResponse)
      sessionServiceMock.assertReceived(verifyRequest)
      wsSecureServer.assertReceived(clientRequest)
    })

    it('rejects requests when session-service responds NOK', async () => {
      sessionServiceMock.addMockFor(verifyRequest, verifyMessage.nok())
      const response = await userClient.send(clientRequest)
      response.should.deep.equal({ status: 'nok', action: 'verify' })
      sessionServiceMock.assertReceived(verifyRequest)
      wsSecureServer.assertReceived()
    })

    it('rejects requests when session-service responds ERROR', async () => {
      const verificationError = { status: ERROR_STATUS, message: 'invalid request' }
      sessionServiceMock.addMockFor(verifyRequest, verificationError)
      const response = await userClient.send(clientRequest)
      response.should.deep.equal({ status: 'error', message: 'session-service unavailable' })
      sessionServiceMock.assertReceived(verifyRequest)
      wsSecureServer.assertReceived()
    })
  })

  describe('session service down', () => {
    before(() => wsSecureServer.start())
    after(() => wsSecureServer.stop())

    it('rejects requests', async () => {
      const response = await userClient.send(clientRequest)
      response.should.deep.equal({ status: 'error', message: 'session-service unavailable' })
      wsSecureServer.assertReceived()
    })
  })

  describe('fatal client errors', () => {
    xit('configuration missing "sessionService" parameter', () => { })
    xit('when missing jwt field', () => {

    })
  })
})
