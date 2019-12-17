const childProcess = require('child_process')

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
  port: 13044, path: '/wallet', authorizedTokens: [walletAuthToken]
}

const useraccountConfig = {
  secret: 'ZTJlLXRlc3Qtc2VjcmV0Cg==',
  version: '0.0.1',
  path: '/uac',
  port: 13500
}

const createClientConfig = ({ port, path, authorizedTokens: [authToken] }) => {
  return { url: `ws://localhost:${port}${path}`, authToken, timeout: 2000 }
}

const sessionProcess = {
  command: 'sessionProcess',
  logname: ' session',
  service: null,
  createService: () => new SessionService(sessionServiceConfig)
}
// const createWalletService = () => new WalletService(walletServiceConfig)

const userAccountProcess = {
  command: 'userAccountProcess',
  logname: 'user-acc',
  service: null,
  createService: () => new UserAccountService({
    httpserver: useraccountConfig,
    sessionService: createClientConfig(sessionServiceConfig.wsserver),
    walletService: createClientConfig(walletServiceConfig),
    db: dbConfig
  })
}

const allProcessDefinitions = [sessionProcess, userAccountProcess]
const serviceLogger = logname => data => data.toString()
  .split(/(\r?\n)/g)
  .filter(line => line.trim().length > 0)
  .forEach(line => { console.log(`[${logname}]`, line) })

const startAll = () => allProcessDefinitions.forEach(processdef => {
  try {
    const process = childProcess.spawn(
      'node', ['orchestrator.e2e.js', processdef.command],
      { cwd: __dirname, detached: true }
    )
    process.stdout.on('data', serviceLogger(processdef.logname))
  } catch (err) {
    console.log('Error starting process:', processdef.logname, err)
    stopAll()
  }
})

const startService = processdef => {
  try {
    console.log('starting:', processdef.logname)
    processdef.service = processdef.createService()
    processdef.service.start()
  } catch (err) {
    console.log('Error starting service:', processdef.logname, err)
    stopAll()
  }
}

const stopAll = () => allProcessDefinitions.forEach(async processdef => {
  try {
    if (processdef.service) {
      console.log('stopping service', processdef.logname)
      await processdef.service.stop()
      processdef.service = null
    }
  } catch (err) {
    console.log('shutdown Error:', processdef.logname, err)
  }
})

process.env.LOG_LEVEL = 'info'
process.on('SIGTERM', stopAll)
process.on('SIGINT', stopAll);

(() => {
  const command = process.argv.splice(2)[0].toLowerCase()
  console.log(`pid=${process.pid}`)
  if (command === 'start') {
    console.log(`baseurl=http://localhost:${useraccountConfig.port}${useraccountConfig.path}`)
    return startAll()
  }

  const processdef = allProcessDefinitions.find(def => def.command.toLowerCase() === command)
  if (processdef) {
    startService(processdef)
  } else {
    console.log(`Error unknown command: ${command}`)
  }
})()
