const childProcess = require('child_process')

const SessionService = require('../session')
const UserAccountService = require('../useraccount')
const WalletService = require('../wallet')
const ChainsOrch = require('../wallet-test/chains.orch')

const { TestDataSetup: { dbConfig, seedTestData } } = require('../test-tools')

const sessionServiceConfig = {
  jwtkey: 'c3VyZSB0aGlzIGlzIGEgcHJvZCBrZXkK',
  wsserver: { path: '/session', port: 13043, authorizedTokens: ['ZTJlLXRlc3QtdG9rZW4K'] },
  db: dbConfig
}

const createClientConfig = ({ port, path, authorizedTokens: [authToken] }) => {
  return { url: `ws://localhost:${port}${path}`, authToken, timeout: 2000 }
}

const walletServiceConfig = {
  wsserver: { port: 13044, path: '/wallet', authorizedTokens: ['c291bmQgb2YgZGEgcG9saWNlCg=='] },
  sessionService: createClientConfig(sessionServiceConfig.wsserver),
  chains: {
    btcnode: ChainsOrch.getChainOrch('btc').defaultBtcAdapterConfig
  },
  db: dbConfig
}

const userAccountServiceConfig = {
  httpserver: { secret: 'ZTJlLXRlc3Qtc2VjcmV0Cg==', version: '0.0.1', path: '/uac', port: 13500 },
  sessionService: createClientConfig(sessionServiceConfig.wsserver),
  walletService: createClientConfig(walletServiceConfig.wsserver),
  db: dbConfig
}

const sessionProcess = {
  command: 'session',
  logname: ' session',
  process: null,
  service: null,
  createService: () => new SessionService(sessionServiceConfig)
}

const userAccountProcess = {
  command: 'user',
  logname: 'user-acc',
  process: null,
  service: null,
  createService: () => new UserAccountService(userAccountServiceConfig)
}

const walletProcess = {
  command: 'wallets',
  logname: ' wallets',
  process: null,
  service: null,
  createService: () => new WalletService(walletServiceConfig)
}

const chainNodesProcess = (() => {
  let keepAliveTimeout
  return {
    command: 'chains',
    logname: '  chains',
    process: null,
    service: null,
    createService: () => ChainsOrch,
    start: async svc => {
      await svc.startNodes()
      const keepAlive = () => {
        keepAliveTimeout = setTimeout(keepAlive, 300)
      }
      keepAlive()
    },
    stop: async svc => {
      clearTimeout(keepAliveTimeout)
      await svc.stopNodes()
    }
  }
})()

const PROCESS_DEFINITIONS = [chainNodesProcess, sessionProcess, userAccountProcess, walletProcess]

const serviceLogger = logname => data => data.toString()
  .split(/(\r?\n)/g)
  .filter(line => line.trim().length > 0)
  .forEach(line => { console.log(`[${logname}]`, line) })

const startAll = () => PROCESS_DEFINITIONS.forEach(processdef => {
  try {
    processdef.process = childProcess.spawn(
      'node', ['orchestrator.e2e.js', processdef.command],
      { cwd: __dirname, detached: true }
    )
    processdef.process.stdout.on('data', serviceLogger(processdef.logname))
  } catch (err) {
    console.log('Error starting process:', processdef.logname, err)
    stopAll()
  }
})

const startService = async processdef => {
  try {
    console.log('starting:', processdef.logname)
    processdef.service = processdef.createService()
    await processdef.start
      ? processdef.start(processdef.service)
      : processdef.service.start()
  } catch (err) {
    console.log('Error starting service:', processdef.logname, err)
    stopAll()
  }
}

const stopAll = () => PROCESS_DEFINITIONS.forEach(async processdef => {
  try {
    if (processdef.service) {
      console.log('stopping service', processdef.logname)
      await processdef.stop
        ? processdef.stop(processdef.service)
        : processdef.service.stop()

      processdef.service = null
    }
    if (processdef.process) {
      console.log('stopping process', processdef.logname)
      await processdef.process.kill()
      processdef.process = null
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
    const { port, path } = userAccountServiceConfig.httpserver
    console.log(`baseurl=http://localhost:${port}${path}`)
    startAll()
    return seedTestData()
  }
  if (command === 'start') {
    return stopAll()
  }

  const processdef = PROCESS_DEFINITIONS.find(def => def.command.toLowerCase() === command)
  return processdef
    ? startService(processdef)
    : console.log(`Error unknown command: ${command}`)
})()
