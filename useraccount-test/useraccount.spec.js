const chai = require('chai')
chai.use(require('chai-string'))

const orchestrator = require('./orchestrator')
// const UserAccountService = require('../useraccount')
const { httpauth } = require('../useraccount/defaults.json')

describe('UserAccountService', () => {
  describe('common', () => {
    const agent = orchestrator.agent()
    before(() => orchestrator.start())
    after(() => orchestrator.stop())

    it('responds with configured version', () => agent.get('/version')
      .then(res => res.text.should.startWith(httpauth.version))
    )
  })

  describe('connection to SessionService', () => {
    it('uses configured authorization key', () => {
      // is configuration really passed on

      // const sessionMockPort = 12532
      // const sessionMockPath = '/mockuasauth'
      // const sessionAuthToken = 'use-this-token-for-the-test'
      // const config = {
      //   httpauth: { port: 12014, path: '/uasauth' },
      //   sessionService: { url: `ws://localhost:${sessionMockPort}${sessionMockPath}`, authToken: sessionAuthToken }
      // }
      // const uas = new UserAccountService(config)
      // uas.debug = true
      // const wssmock = mockServer(sessionMockPort, sessionMockPath)
      // return wssmock.start()
      //   .then(() => uas.start())
      //   .then(() => wssmock.received.authTokens.should.include(sessionAuthToken))
      //   .finally(() => {
      //     console.log('------ CALLING STOP ON UserAccountService')
      //     uas.stop()
      //   })
      //   .finally(() => {
      //     console.log('------ CALLING STOP ON mockServer')
      //     wssmock.stop()
      //   })
    })
  })
})
