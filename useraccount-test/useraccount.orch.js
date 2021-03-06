const chai = require('chai')
chai.use(require('chai-http'))
const cheerio = require('cheerio')

const UserAccountService = require('../useraccount')
const { wsmessages: { withAction } } = require('../utils')
const { WSServerMock, pwhasher, TestDataSetup: { dbConfig } } = require('../test-tools')

const authToken = 'dXNlcmFjY291bm50LXRlc3QtdG9rZW4K'
const walletToken = 'aG9wc2Fhc3Nhc3NzYXNzc3Nhc3MK'
const sessionMockConfig = { path: '/sessionmock', port: 12500, authTokens: [authToken] }
const walletMockConfig = { path: '/walletmock', port: 12501, authTokens: [walletToken] }

const httpserverConfig = {
  secret: 'dXNlcmFjY291bnQtdGVzdC1zZWNyZXQK',
  version: '99.0.1',
  path: '/uacc-test',
  port: 12023
}

const createClientConfig = ({ port, path, authTokens: [authToken] }) => {
  return { url: `ws://localhost:${port}${path}`, authToken, timeout: 40, pingInterval: 20000 }
}

const userAccountService = new UserAccountService({
  httpserver: httpserverConfig,
  sessionService: createClientConfig(sessionMockConfig),
  walletService: createClientConfig(walletMockConfig),
  db: dbConfig,
  clientTimeout: 1000
})

const sessionMock = new WSServerMock(sessionMockConfig, 'uac session-mock')
const walletMock = new WSServerMock(walletMockConfig, 'uac wallet-mock')
walletMock.offerTopics('invoices', 'blocks')

const loginMessages = withAction('login')
const verifyMessages = withAction('verify')

const testUserId = '123456789012345678901234'
const testEmail = 'uaorch-test-user@test.com'
const testPassword = 'abcdefghijk'
const testJwt = 'blablalbalblabla'

const withJwtMessages = (obj, jwt = testJwt) => Object.assign({ jwt }, obj)

const testRun = {
  allRequestsAuthenticated: false,
  user: { email: testEmail, password: testPassword },
  sessionMessages: {
    loginRequest: loginMessages.build({ email: testEmail, password: pwhasher(testPassword) }),
    loginResponse: withJwtMessages(loginMessages.ok()),
    verifyRequest: withJwtMessages(verifyMessages.build()),
    verifyResponse: verifyMessages.ok({ user: { id: testUserId, email: testEmail } })
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

const start = ({ authenticatedAgent = false } = {}) => Promise
  .all([sessionMock.start(), walletMock.start(), userAccountService.start()])
  .then(async () => {
    testRun.allRequestsAuthenticated = authenticatedAgent
    return {
      useragent: await createAgent({ authenticated: authenticatedAgent, crsf: true }),
      sessionMock,
      walletMock
    }
  })

const stop = () => Promise.all([userAccountService.stop(), sessionMock.stop(), walletMock.stop()])

const createAgent = async ({ authenticated = false, crsf = false }) => {
  const useragent = chai.request.agent(`http://localhost:${httpserverConfig.port}${httpserverConfig.path}`)
  if (authenticated) {
    sessionMock.softReset()
    await useragent.get('/version')
    const res = await useragent.post('/login').type('form').send(testRun.user)
    withHtml(res).html.pageTitle().should.equal('mex home')
  } else if (crsf) {
    const res = await useragent.get('/version')
    res.should.have.status(200)
  }
  return useragent
}

beforeEach(async () => sessionMock.softReset())
afterEach(() => {
  sessionMock.errorCheck()
  walletMock.errorCheck()
})

const HtmlWrapper = $ => {
  const pageTitle = () => $('title').text()
  return { $, pageTitle }
}

const withHtml = res => {
  res.html = HtmlWrapper(cheerio.load(res.text))
  return res
}

module.exports = { start, stop, createAgent, withHtml, testUserId, httpserverConfig, withJwtMessages }
