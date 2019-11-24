const chai = require('chai')
chai.use(require('chai-http'))
const cheerio = require('cheerio')

const UserAccountService = require('../useraccount')

const sessionMockConfig = { path: '/sessionmock', port: 12500 }

const httpauth = { path: '/test', port: 12011 }
const sessionService = {
  url: `ws://localhost:${sessionMockConfig.port}${sessionMockConfig.path}`,
  authToken: 'not-used-in-tests-75678',
  sendTimeout: 500
}

const service = new UserAccountService({ httpauth, sessionService })

const debug = enable => {
  service.debug = enable
}

const start = () => service.start()
const stop = () => service.stop()

const agent = () => chai.request.agent(`http://localhost:${httpauth.port}${httpauth.path}`)
const asHtml = res => cheerio.load(res.text)

module.exports = { start, stop, agent, asHtml, debug }
