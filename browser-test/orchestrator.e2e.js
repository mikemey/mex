const UserAccountService = require('../useraccount')
const { SessionService } = require('../session')
const { sessionServiceConfig, useraccountConfig, useraccountSessionClientConfig } = require('./orchestrator.config')

const sessionService = new SessionService(sessionServiceConfig)
const uacService = new UserAccountService({
  httpserver: useraccountConfig,
  sessionService: useraccountSessionClientConfig
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
