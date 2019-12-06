const chai = require('chai')
chai.use(require('chai-http'))
const cheerio = require('cheerio')
const { sign, decode } = require('jsonwebtoken')

const UserAccountService = require('../useraccount')
const { wsmessages: { withAction } } = require('../utils')
const { WSServerMock, pwhasher } = require('../test-tools')

const authToken = 'dXNlcmFjY291bm50LXRlc3QtdG9rZW4K'
const sessionMockConfig = { path: '/sessionmock', port: 12500, authorizedTokens: [authToken] }

const httpserverConfig = { path: '/uacc-test', port: 12023 }
const sessionServiceConfig = {
  url: `ws://localhost:${sessionMockConfig.port}${sessionMockConfig.path}`,
  authToken,
  timeout: 40
}

const service = new UserAccountService({ httpserver: httpserverConfig, sessionService: sessionServiceConfig })
const sessionMock = new WSServerMock(sessionMockConfig)

const loginMessages = withAction('login')
const verifyMessages = withAction('verify')

const testId = '987654321'
const testEmail = 'uaorch-test-user'
const testPassword = 'abcdefghijk'
const testJwt = sign({ id: testId }, 'whateva')

const testRun = {
  user: { email: 'uaorch-test-user', password: 'abcdefghijk' },
  sessionMessages: {
    loginRequest: loginMessages.build({ email: testEmail, password: pwhasher(testPassword) }),
    loginResponse: loginMessages.ok({ jwt: testJwt }),
    verifyRequest: verifyMessages.build({ jwt: testJwt }),
    verifyResponse: verifyMessages.ok()
  }
}

const start = ({
  startSessionMock = true, startService = true, authenticatedAgent = false
} = {}) => Promise.all([
  startSessionMock ? sessionMock.start() : Promise.resolve(),
  startService ? service.start() : Promise.resolve()
]).then(() => createAgent(authenticatedAgent))

const stop = () => Promise.all([service.stop(), sessionMock.stop()])

const createAgent = async authenticated => {
  const agent = chai.request.agent(`http://localhost:${httpserverConfig.port}${httpserverConfig.path}`)
  if (authenticated) {
    const { loginRequest, loginResponse, verifyRequest, verifyResponse } = testRun.sessionMessages
    sessionMock.addMockFor(verifyRequest, verifyResponse)
    sessionMock.addMockFor(loginRequest, loginResponse)
    await agent.get('/version')
    await agent.post('/login').type('form').send(testRun.user)
  }
  return agent
}

beforeEach(async () => sessionMock.reset())
afterEach(() => sessionMock.errorCheck())

const HtmlWrapper = $ => {
  const pageTitle = () => $('title').text()
  return { $, pageTitle }
}

const withHtml = res => {
  res.html = HtmlWrapper(cheerio.load(res.text))
  return res
}

module.exports = { start, stop, createAgent, withHtml, sessionMock }
