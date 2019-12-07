const chai = require('chai')
chai.use(require('chai-http'))
const cheerio = require('cheerio')
const { sign } = require('jsonwebtoken')

const UserAccountService = require('../useraccount')
const { wsmessages: { withAction } } = require('../utils')
const { WSServerMock, pwhasher, TestDataSetup: { dbConfig } } = require('../test-tools')

const authToken = 'dXNlcmFjY291bm50LXRlc3QtdG9rZW4K'
const sessionMockConfig = { path: '/sessionmock', port: 12500, authorizedTokens: [authToken] }
const walletMockConfig = { path: '/walletmock', port: 12501, authorizedTokens: [authToken] }

const httpserverConfig = {
  secret: 'dXNlcmFjY291bnQtdGVzdC1zZWNyZXQK',
  version: '99.0.1',
  path: '/uacc-test',
  port: 12023
}

const createClientConfig = ({ port, path }) => {
  return { url: `ws://localhost:${port}${path}`, authToken, timeout: 40 }
}

const userAccountService = new UserAccountService({
  httpserver: httpserverConfig,
  sessionService: createClientConfig(sessionMockConfig),
  walletService: createClientConfig(walletMockConfig),
  db: dbConfig
})

const sessionMock = new WSServerMock(sessionMockConfig)

const loginMessages = withAction('login')
const verifyMessages = withAction('verify')

const testUserId = '123456789012345678901234'
const testEmail = 'uaorch-test-user@test.com'
const testPassword = 'abcdefghijk'
const testJwt = sign({ id: testUserId }, 'whateva')

const testRun = {
  allRequestsAuthenticated: false,
  user: { email: testEmail, password: testPassword },
  sessionMessages: {
    loginRequest: loginMessages.build({ email: testEmail, password: pwhasher(testPassword) }),
    loginResponse: loginMessages.ok({ jwt: testJwt }),
    verifyRequest: verifyMessages.build({ jwt: testJwt }),
    verifyResponse: verifyMessages.ok()
  }
}

sessionMock.softReset = () => {
  sessionMock.reset()
  if (testRun.allRequestsAuthenticated) {
    const { loginRequest, loginResponse, verifyRequest, verifyResponse } = testRun.sessionMessages
    sessionMock.addMockFor(verifyRequest, verifyResponse)
    sessionMock.addMockFor(loginRequest, loginResponse)
  }
}

const start = ({ startSessionMock = true, startService = true, authenticatedAgent = false } = {}) => Promise
  .all([
    startSessionMock ? sessionMock.start() : Promise.resolve(),
    startService ? userAccountService.start() : Promise.resolve()
  ])
  .then(async () => {
    testRun.allRequestsAuthenticated = authenticatedAgent
    return {
      useragent: await createAgent({ authenticated: authenticatedAgent, crsf: true }),
      sessionMock
    }
  })

const stop = () => Promise.all([userAccountService.stop(), sessionMock.stop()])

const createAgent = async ({ authenticated = false, crsf = false }) => {
  const useragent = chai.request.agent(`http://localhost:${httpserverConfig.port}${httpserverConfig.path}`)
  if (authenticated) {
    sessionMock.softReset()
    await useragent.get('/version')
    const res = await useragent.post('/login').type('form').send(testRun.user)
    withHtml(res).html.pageTitle().should.equal('mex home')
  } else if (crsf) {
    await useragent.get('/version')
  }
  return useragent
}

beforeEach(async () => sessionMock.softReset())
afterEach(() => sessionMock.errorCheck())

const HtmlWrapper = $ => {
  const pageTitle = () => $('title').text()
  return { $, pageTitle }
}

const withHtml = res => {
  res.html = HtmlWrapper(cheerio.load(res.text))
  return res
}

module.exports = { start, stop, createAgent, withHtml, testUserId, httpserverConfig }
