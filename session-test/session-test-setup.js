const { TestDataSetup: { dbConfig, seedTestData, registeredUser } } = require('../test-tools')
const { wsmessages: { OK_STATUS } } = require('../utils')

const { WSClient } = require('../connectors')
const { SessionService } = require('../session')

const testToken = 'c2Vzc2lvbi1zZXJ2aWNlLXRlc3R0b2tlbgo='
const port = 12021
const path = '/sessions'
const url = `ws://localhost:${port}${path}`

const testConfig = {
  jwtkey: 'ZCdvaCwganVzdCBhIHRlc3RrZXkK',
  wsserver: { port, path, authorizedTokens: [testToken] },
  db: dbConfig
}
const sessionService = new SessionService(testConfig)
const wsClient = new WSClient({ url, authToken: testToken, timeout: 1500 })

const startService = () => {
  seedTestData()
  return sessionService.start()
}

const stopService = () => { return sessionService.stop() }

const loginRequest = ({ email = registeredUser.email, password = registeredUser.password, action = 'login' } = {}) => {
  return { action, email, password }
}

const loginTestUser = () => wsClient.send(loginRequest())
  .then(result => {
    result.status.should.equal(OK_STATUS)
    return result
  })

module.exports = { sessionConfig: testConfig, wsClient, startService, stopService, loginTestUser, loginRequest, registeredUser }
