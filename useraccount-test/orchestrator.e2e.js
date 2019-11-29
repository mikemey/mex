const { dbconnection } = require('../utils')
const UserAccountService = require('../useraccount')
const { SessionRegisterService } = require('../session')

const authToken = 'e2e-token-7567812341'
const sessionServiceConfig = { path: '/session', port: 13043, authorizedTokens: [authToken] }

const dbConfig = { url: 'mongodb://127.0.0.1:27017', name: 'mex-test' }
const uacServiceConfig = { path: '/uac', port: 13500 }
const uacSessionConfig = {
  url: `ws://localhost:${sessionServiceConfig.port}${sessionServiceConfig.path}`,
  authToken,
  timeout: 2000
}

const sessionService = new SessionRegisterService(sessionServiceConfig)
sessionService.debug = true
const uacService = new UserAccountService({ httpserver: uacServiceConfig, sessionService: uacSessionConfig })
uacService.debug = true

const uacurl = `http://localhost:${uacServiceConfig.port}${uacServiceConfig.path}`

const start = () => Promise.all([
  dbconnection.connect(dbConfig.url, dbConfig.name),
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
  dbconnection.close(),
  uacService.stop(), sessionService.stop()
]).catch(err => {
  console.log('shutdown error:', err.message)
})

process.env.TESTING = true
process.on('SIGTERM', stop)
process.on('SIGINT', stop)

start()
