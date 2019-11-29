const UserAccountService = require('../useraccount')
const { SessionRegisterService } = require('../session')

const authToken = 'e2e-token-7567812341'
const sessionServiceConfig = {
  wsserver: { path: '/session', port: 13043, authorizedTokens: [authToken] },
  db: { url: 'mongodb://127.0.0.1:27017', name: 'mex-test' }
}

const useraccountConfig = { path: '/uac', port: 13500 }
const sessionConfig = {
  url: `ws://localhost:${sessionServiceConfig.port}${sessionServiceConfig.path}`,
  authToken,
  timeout: 2000
}

const sessionService = new SessionRegisterService(sessionServiceConfig)
sessionService.debug = true
const uacService = new UserAccountService({ httpserver: useraccountConfig, sessionService: sessionConfig })
uacService.debug = true

const uacurl = `http://localhost:${useraccountConfig.port}${useraccountConfig.path}`

const start = () => Promise.all([
  uacService.start(), sessionService.start()
]).then(() => {
  console.log(`baseurl=${uacurl}`)
  console.log(`pid=${process.pid}`)
}).catch(err => {
  console.log('ORCHESTRATOR ERROR:', err.message)
  console.log('shutting down')
  return stop()
})

const stop = () => Promise.all([
  uacService.stop(), sessionService.stop()
]).catch(err => {
  console.log('shutdown error:', err.message)
})

process.env.TESTING = true
process.on('SIGTERM', stop)
process.on('SIGINT', stop)

start()
