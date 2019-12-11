const { pwhasher, TestDataSetup: { dbConfig, seedTestData, registeredUser } } = require('../test-tools')
const { wsmessages: { OK_STATUS } } = require('../utils')

const { WSClient } = require('../connectors')
const SessionService = require('../session')

const testToken = 'c2Vzc2lvbi1zZXJ2aWNlLXRlc3R0b2tlbgo='
const port = 12021
const path = '/sessions'
const url = `ws://localhost:${port}${path}`

const outdatedJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVkZTM2M2ZiZDBmNjEwNDIwM' +
  'zVkYzYwMyIsImVtYWlsIjoidGVzdF91c2VyQHRlc3QuY29tIiwiaWF0IjoxNTc1Mjg3MTM' +
  '4LCJleHAiOjE1NzUyOTQzMzh9.JUCz3CvyyMS-Jhh0s0ucDnaQ2zUs8diTl8KC59FcL14'

const testConfig = {
  jwtkey: 'ZCdvaCwganVzdCBhIHRlc3RrZXkK',
  wsserver: { port, path, authorizedTokens: [testToken] },
  db: dbConfig
}
const sessionService = new SessionService(testConfig)
const wsClient = new WSClient({ url, authToken: testToken, timeout: 1500 }, 'session-test-client')

const startService = () => {
  seedTestData()
  return sessionService.start()
}

const stopService = () => { return sessionService.stop() }

const loginRequest = ({
  email = registeredUser.email,
  password = pwhasher(registeredUser.password),
  action = 'login'
} = {}) => {
  return { action, email, password }
}

const loginTestUser = () => wsClient.send(loginRequest())
  .then(result => {
    result.status.should.equal(OK_STATUS)
    return result
  })

module.exports = {
  sessionService,
  sessionConfig: testConfig,
  wsClient,
  startService,
  stopService,
  loginTestUser,
  loginRequest,
  registeredUser,
  outdatedJwt
}
