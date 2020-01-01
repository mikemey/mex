const childProcess = require('child_process')

const SessionService = require('../session')
const UserAccountService = require('../useraccount')
const WalletService = require('../wallet')
const chainsOrch = require('../wallet-test/chains.orch')

const { TestDataSetup: { dbConfig, seedTestData } } = require('../test-tools')

const sessionServiceConfig = {
  jwtkey: 'c3VyZSB0aGlzIGlzIGEgcHJvZCBrZXkK',
  wsserver: { path: '/session', port: 13043, authTokens: ['ZTJlLXRlc3QtdG9rZW4K'] },
  db: dbConfig
}

const createClientConfig = ({ port, path, authTokens: [authToken] }) => {
  return { url: `ws://localhost:${port}${path}`, authToken, timeout: 2000, pingInterval: 30000 }
}

const walletServiceConfig = {
  wsserver: { port: 13044, path: '/wallet', authTokens: ['c291bmQgb2YgZGEgcG9saWNlCg=='] },
  sessionService: createClientConfig(sessionServiceConfig.wsserver),
  chains: {
    btcnode: chainsOrch.getChainOrch('btc').defaultBtcAdapterConfig
  },
  db: dbConfig
}

const userAccountServiceConfig = {
  httpserver: { secret: 'ZTJlLXRlc3Qtc2VjcmV0Cg==', version: '0.0.1', path: '/uac', port: 13500 },
  sessionService: createClientConfig(sessionServiceConfig.wsserver),
  walletService: createClientConfig(walletServiceConfig.wsserver),
  db: dbConfig,
  clientTimeout: 30000
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
  command: 'wallet',
  logname: '  wallet',
  process: null,
  service: null,
  createService: () => new WalletService(walletServiceConfig)
}

const PROCESS_DEFINITIONS = [sessionProcess, walletProcess, userAccountProcess]

const serviceLogger = logname => data => data.toString()
  .split(/(\r?\n)/g)
  .filter(line => line.trim().length > 0)
  .forEach(line => { console.log(`[${logname}]`, line) })

const redirectOutput = (stream, logger) => {
  stream.setEncoding('utf8')
  stream.on('data', logger)
}

const startAll = async () => {
  try {
    await chainsOrch.startNodes()
    PROCESS_DEFINITIONS.map(spawnProcess)
  } catch (err) {
    console.log('Error starting process:', err)
    await stopAll()
  }
}

const spawnProcess = processdef => {
  processdef.process = childProcess.spawn(
    'node', [__filename, processdef.command],
    { cwd: __dirname, detached: true }
  )
  redirectOutput(processdef.process.stdout, serviceLogger(processdef.logname))
  redirectOutput(processdef.process.stderr, serviceLogger(processdef.logname))
}

const startService = async processdef => {
  try {
    console.log('starting:', processdef.logname)
    processdef.service = processdef.createService()
    await processdef.service.start()
  } catch (err) {
    console.log('Error starting service:', processdef.logname, err)
    stopAll()
  }
}

const stopAll = () => chainsOrch.stopNodes()
  .catch(err => { console.log('chain-nodes shutdown Error:', err) })
  .then(() => PROCESS_DEFINITIONS.forEach(processdef => {
    if (processdef.service) {
      console.log('stopping service', processdef.logname)
      return processdef.service.stop()
        .catch(err => {
          console.log('shutdown Error:', processdef.logname, err)
        })
    }
    if (processdef.process) {
      console.log('stopping process', processdef.logname)
      processdef.process.kill()
      processdef.process = null
    }
  }))

process.env.LOG_LEVEL = 'info'
process.on('SIGTERM', stopAll)
process.on('SIGINT', stopAll);

(() => {
  const command = process.argv.splice(2)[0].toLowerCase()
  console.log(`pid=${process.pid}`)
  if (command === 'start') {
    const { port, path } = userAccountServiceConfig.httpserver
    console.log(`baseurl=http://localhost:${port}${path}`)
    return startAll().then(seedTestData)
  }
  if (command === 'stop') {
    return stopAll()
  }

  const processdef = PROCESS_DEFINITIONS.find(def => def.command.toLowerCase() === command)
  return processdef
    ? startService(processdef)
    : console.log(`Error unknown command: ${command}`)
})()
