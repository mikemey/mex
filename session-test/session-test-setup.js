const { TestDataSetup } = require('../test-tools')

const { WSClient } = require('../security')
const { SessionService } = require('../session')

const testToken = 'session-service-testtoken'
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

module.exports = { sessionService, wsClient, start, stop }
