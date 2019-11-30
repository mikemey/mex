const chai = require('chai')
chai.use(require('chai-http'))
const cheerio = require('cheerio')

const UserAccountService = require('../useraccount')
const { WSServerMock } = require('../testtools')

const authToken = 'test-token-756781234'
const sessionMockConfig = { path: '/sessionmock', port: 12500, authorizedTokens: [authToken] }

const httpserverConfig = { path: '/uacc-test', port: 12023 }
const sessionServiceConfig = {
  url: `ws://localhost:${sessionMockConfig.port}${sessionMockConfig.path}`,
  authToken,
  timeout: 40
}

const service = new UserAccountService({ httpserver: httpserverConfig, sessionService: sessionServiceConfig })
const sessionMock = new WSServerMock(sessionMockConfig)

const start = ({ startMock = true, startService = true } = {}) => Promise.all([
  startMock ? sessionMock.start() : Promise.resolve(),
  startService ? service.start() : Promise.resolve()
])
const stop = () => Promise.all([service.stop(), sessionMock.stop()])

const agent = () => chai.request.agent(`http://localhost:${httpserverConfig.port}${httpserverConfig.path}`)

const HtmlWrapper = $ => {
  const pageTitle = () => $('title').text()
  return { $, pageTitle }
}

const withHtml = res => {
  res.html = HtmlWrapper(cheerio.load(res.text))
  return res
}

module.exports = { start, stop, agent, withHtml, sessionMock }
