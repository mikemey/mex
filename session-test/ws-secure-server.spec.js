const { WSSecureServer } = require('../session')
const { WSClient } = require('../connectors')
const { WSServerMock } = require('../test-tools')
const { wsmessages: { withAction, OK_STATUS, NOK_STATUS, ERROR_STATUS } } = require('../utils')

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

  // sessionServiceMock.debug = true
  // wsSecureServer.debug = true
  // userClient.debug = true

  const testJwt = 'bladibladibla'
  const clientRequest = { jwt: testJwt, action: 'just-testing' }

  const verifyMessage = withAction('verify')
  const verifyRequest = verifyMessage.build({ jwt: testJwt })

  describe('session service running', () => {
    before(() => Promise.all([wsSecureServer.start(), sessionServiceMock.start()]))
    after(() => Promise.all([wsSecureServer.stop(), sessionServiceMock.stop()]))
    beforeEach(() => Promise.all([wsSecureServer.reset(), sessionServiceMock.reset()]))

    it('allows requests with valid JWT', async () => {
      sessionServiceMock.addMockFor(verifyRequest, verifyMessage.ok())
      const response = await userClient.send(clientRequest)
      response.should.deep.equal(secureServerResponse)
      sessionServiceMock.assertReceived(verifyRequest)
      wsSecureServer.assertReceived(clientRequest)
    })

    it('rejects requests with invalid JWT', async () => {
      sessionServiceMock.addMockFor(verifyRequest, verifyMessage.nok())
      const response = await userClient.send(clientRequest)
      response.should.deep.equal(verifyMessage.nok())
      sessionServiceMock.assertReceived(verifyRequest)
      wsSecureServer.assertReceived()
    })
  })

  describe('session service down', () => {
    xit('rejects requests', () => {

    })

    xit('configuration missing "sessionService" parameter', () => { })
  })

  describe('fatal client errors', () => {
    xit('when missing jwt field', () => {

    })
  })
})
