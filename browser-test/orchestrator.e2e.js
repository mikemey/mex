const UserAccountService = require('../useraccount')
const SessionService = require('../session')
const { TestDataSetup: { dbConfig } } = require('../test-tools')

const authToken = 'ZTJlLXRlc3QtdG9rZW4K'
const sessionServiceConfig = {
  jwtkey: 'c3VyZSB0aGlzIGlzIGEgcHJvZCBrZXkK',
  wsserver: { path: '/session', port: 13043, authorizedTokens: [authToken] },
  db: dbConfig
}

const useraccountConfig = {
  secret: 'ZTJlLXRlc3Qtc2VjcmV0Cg==',
  version: '0.0.1',
  path: '/uac',
  port: 13500
}

const sessionService = new SessionService(sessionServiceConfig)
const uacService = new UserAccountService({
  httpserver: useraccountConfig,
  sessionService: {
    url: `ws://localhost:${sessionServiceConfig.wsserver.port}${sessionServiceConfig.wsserver.path}`,
    authToken,
    timeout: 2000
  },
  db: dbConfig
})

const testBaseUrl = `http://localhost:${useraccountConfig.port}${useraccountConfig.path}`

const start = () => Promise.all([
  uacService.start(), sessionService.start()
]).then(() => {
  console.log(`baseurl=${testBaseUrl}`)
  console.log(`pid=${process.pid}`)
}).catch(err => {
  console.log('ORCHESTRATOR ERROR:', err.message)
  console.log('shutting down')
  return stop()
})

const stop = () => Promise.all([
  uacService.stop(), sessionService.stop()
]).catch(err => {
  console.log('shutdown ERROR:', err.message)
})

process.env.TESTING = true
process.on('SIGTERM', stop)
process.on('SIGINT', stop)

start()
