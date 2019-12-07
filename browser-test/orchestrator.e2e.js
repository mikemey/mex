const UserAccountService = require('../useraccount')
const SessionService = require('../session')
const { TestDataSetup: { dbConfig } } = require('../test-tools')

const sessionAuthToken = 'ZTJlLXRlc3QtdG9rZW4K'
const sessionServiceConfig = {
  jwtkey: 'c3VyZSB0aGlzIGlzIGEgcHJvZCBrZXkK',
  wsserver: { path: '/session', port: 13043, authorizedTokens: [sessionAuthToken] },
  db: dbConfig
}

const walletAuthToken = 'c291bmQgb2YgZGEgcG9saWNlCg=='
const walletServiceConfig = {
  path: '/wallet', port: 13044, authorizedTokens: [walletAuthToken]
}

const useraccountConfig = {
  secret: 'ZTJlLXRlc3Qtc2VjcmV0Cg==',
  version: '0.0.1',
  path: '/uac',
  port: 13500
}

const sessionService = new SessionService(sessionServiceConfig)
// const walletService = new WalletService(walletServiceConfig)
const createClientConfig = ({ port, path, authorizedTokens: [authToken] }) => {
  return { url: `ws://localhost:${port}${path}`, authToken, timeout: 2000 }
}

const uacService = new UserAccountService({
  httpserver: useraccountConfig,
  sessionService: createClientConfig(sessionServiceConfig.wsserver),
  walletService: createClientConfig(walletServiceConfig),
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
