const { TestDataSetup } = require('../test-tools')

const { WSClient } = require('../connectors')
const { SessionService } = require('../session')

const testToken = 'c2Vzc2lvbi1zZXJ2aWNlLXRlc3R0b2tlbgo='
const port = 12021
const path = '/sessions'
const url = `ws://localhost:${port}${path}`

const testConfig = {
  wsserver: { port, path, authorizedTokens: [testToken] },
  db: TestDataSetup.dbConfig
}
const sessionService = new SessionService(testConfig)
const wsClient = new WSClient({ url, authToken: testToken, timeout: 1500 })

const start = () => {
  TestDataSetup.seedTestData()
  return sessionService.start()
}

const stop = () => { return sessionService.stop() }

module.exports = { sessionConfig: testConfig, wsClient, start, stop, registeredUser: TestDataSetup.registeredUser }
