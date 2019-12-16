const childProcess = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const download = require('download')
const BitcoinClient = require('bitcoin-core')

const { Logger } = require('../../utils')
const logger = Logger('btc node orchetrator')

const btcversion = '0.19.0.1'
const dataDir = path.join(__dirname, '.regtest')

const btcClientConfig = {
  network: 'regtest',
  host: '127.0.0.1',
  port: 24842,
  username: 'regtester',
  password: 'regtester'
}
const zmqConfig = 'tcp://127.0.0.1:19591'

const mainWalletName = 'mex-test-wallet'
const faucetWalletName = 'faucet'
const thirdWalletName = 'third-party-wallet'

const walletConfig = (wallet = mainWalletName) => Object.assign({ wallet }, btcClientConfig)

const faucetWallet = new BitcoinClient(walletConfig(faucetWalletName))
const thirdPartyWallet = new BitcoinClient(walletConfig(thirdWalletName))

const defaultBtcAdapterConfig = {
  client: walletConfig(),
  zmq: zmqConfig
}

const btcConfigFile = {
  location: path.join(dataDir, 'bitcoin.conf'),
  content: {
    regtest: 1,
    pid: path.join(dataDir, 'regtest.pid'),
    rest: 1,
    sections: {
      regtest: {
        daemon: 1,
        rpcauth: 'regtester:a1c4c0cf083f71dc25d230298beab0a9$479765cb0999b734931ddfe4ac0a5b6245ff6ebd13a36d675432ea88817e5d7f',
        rpcport: btcClientConfig.port,
        wallet: [faucetWalletName, mainWalletName, thirdWalletName],
        zmqpubhashtx: zmqConfig,
        zmqpubrawtx: zmqConfig,
        zmqpubhashblock: zmqConfig,
        zmqpubrawblock: zmqConfig
      }
    }
  }
}

const setupCfg = {
  btcBinUrl: `https://bitcoincore.org/bin/bitcoin-core-${btcversion}/bitcoin-${btcversion}-osx64.tar.gz`,
  btcBinDir: path.join(dataDir, `bitcoin-${btcversion}`, 'bin'),
  dataDirArg: `-datadir=${dataDir}`,
  minFaucetBalance: 50
}

const oscheck = () => {
  if (os.platform() !== 'darwin') {
    throw Error('platform not supported:', os.platform())
  }
}

const installBinaries = () => {
  logger.info('installing regtest to', dataDir)
  fs.mkdirSync(dataDir)
  return download(setupCfg.btcBinUrl, dataDir, { extract: true })
}

const writeConfigFile = () => {
  const content = Object.assign({}, btcConfigFile.content)
  const sections = content.sections
  delete content.sections

  const configData = []
  configData.push(...keyValuePair(content))
  for (const key in sections) {
    configData.push(`[${key}]`)
    configData.push(...keyValuePair(sections[key]))
  }
  fs.writeFileSync(btcConfigFile.location, configData.join('\n'))
}

const keyValuePair = obj => Object.keys(obj)
  .reduce((all, key) => Array.isArray(obj[key])
    ? [...all, ...obj[key].map(elem => `${key}=${elem}`)]
    : [...all, `${key}=${obj[key]}`], [])

const startBitcoind = () => {
  if (fs.existsSync(btcConfigFile.content.pid)) {
    logger.debug('bitcoind already running')
    return
  }
  const command = path.join(setupCfg.btcBinDir, 'bitcoind')
  const args = [setupCfg.dataDirArg]
  childProcess.spawnSync(command, args)
  logger.debug('bitcoind started')
}

const waitForFaucet = (attempts = 9) => new Promise((resolve, reject) => {
  const checkWallet = currentAttempt => {
    if (currentAttempt <= 0) { return reject(Error('Faucet wallet not available!')) }
    logger.debug(`waiting for wallet (${currentAttempt})...`)

    setTimeout(() => {
      faucetWallet.getWalletInfo()
        .then(resolve)
        .catch(_ => checkWallet(currentAttempt - 1))
    }, 250)
  }
  checkWallet(attempts)
})

const generateBlocks = (blocks = 1) => faucetWallet.getNewAddress()
  .then(address => {
    logger.debug('generateToAddress', address)
    return faucetWallet.generateToAddress(blocks, address)
  })

const refillFaucet = () => {
  const needMoreBlocks = () => generateBlocks()
    .then(() => faucetWallet.command('getbalances'))
    .then(balances => {
      if (balances.mine.trusted < setupCfg.minFaucetBalance) {
        return needMoreBlocks()
      }
    })
  return needMoreBlocks()
}

const startNode = async function () {
  if (this.timeout) { this.timeout(60000) }
  oscheck()
  if (!fs.existsSync(btcConfigFile.location)) {
    await installBinaries()
    writeConfigFile()
    await startBitcoind()
    await waitForFaucet(30)
    await generateBlocks(101)
  } else {
    writeConfigFile()
    await startBitcoind()
    const walletInfo = await waitForFaucet()
    if (walletInfo.balance < setupCfg.minFaucetBalance) {
      await refillFaucet()
    }
  }
}

const stopNode = async () => {
  const command = path.join(setupCfg.btcBinDir, 'bitcoin-cli')
  const args = [setupCfg.dataDirArg, 'stop']
  childProcess.spawnSync(command, args)
  await waitForNodeDown()
  logger.debug('bitcoind stopped')
}

const waitForNodeDown = (attempts = 9) => new Promise((resolve, reject) => {
  const checkPidFile = currentAttempt => {
    if (currentAttempt <= 0) { return reject(Error('bitcoind shutdown failed!')) }
    logger.debug(`waiting for shutdown (${currentAttempt})...`)

    setTimeout(() => {
      fs.access(btcConfigFile.content.pid, fs.F_OK, (err) => {
        if (err) { return resolve() }
        checkPidFile(currentAttempt - 1)
      })
    }, 500)
  }
  checkPidFile(attempts)
})

module.exports = {
  startNode, stopNode, generateBlocks, faucetWallet, thirdPartyWallet, walletConfig, defaultBtcAdapterConfig
}
