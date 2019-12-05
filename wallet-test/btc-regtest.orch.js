const childProcess = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const download = require('download')
const BitcoinClient = require('bitcoin-core')

const btcversion = '0.19.0.1'
const dataDir = path.join(__dirname, '.regtest')

const btcClientConfig = {
  network: 'regtest',
  host: '127.0.0.1',
  port: 24842,
  username: 'regtester',
  password: 'regtester'
}

const mainWalletName = 'mex-test-wallet'
const faucetWalletName = 'faucet'

const mainWalletConfig = (wallet = mainWalletName) => Object.assign({ wallet }, btcClientConfig)
const faucetWallet = new BitcoinClient(mainWalletConfig(faucetWalletName))

const btcConfigFile = {
  location: path.join(dataDir, 'bitcoin.conf'),
  content: {
    regtest: 1,
    pid: path.join(dataDir, 'regtest.pid'),
    sections: {
      regtest: {
        bind: '127.0.0.1',
        daemon: 1,
        server: 1,
        rpcauth: 'regtester:a1c4c0cf083f71dc25d230298beab0a9$479765cb0999b734931ddfe4ac0a5b6245ff6ebd13a36d675432ea88817e5d7f',
        rpcbind: btcClientConfig.host,
        port: 36963,
        rpcport: btcClientConfig.port,
        wallet: [faucetWalletName, mainWalletName]
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
  console.log('installing regtest to', dataDir)
  fs.mkdirSync(dataDir)
  return download(setupCfg.btcBinUrl, dataDir, { extract: true })
}

const writeConfigFile = () => {
  const content = btcConfigFile.content
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
    console.log('bitcoind already running')
    return
  }
  const command = path.join(setupCfg.btcBinDir, 'bitcoind')
  const args = [setupCfg.dataDirArg]
  childProcess.spawnSync(command, args)
  console.log('bitcoind started')
}

const waitForFaucet = (attempts = 9) => new Promise((resolve, reject) => {
  const checkWallet = currentAttempt => {
    if (currentAttempt <= 0) { return reject(Error('Faucet wallet not available!')) }
    console.log(`waiting for wallet (${currentAttempt})...`)

    setTimeout(() => {
      faucetWallet.getWalletInfo()
        .then(resolve)
        .catch(_ => checkWallet(currentAttempt - 1))
    }, 250)
  }
  checkWallet(attempts)
})

const generateBlocks = (blocks = 1) => faucetWallet.getNewAddress()
  .then(address => faucetWallet.generateToAddress(blocks, address))

const refillFaucet = () => {
  const faucet = faucetWallet
  const needMoreBlocks = () => generateBlocks()
    .then(() => faucet.command('getbalances'))
    .then(balances => {
      if (balances.mine.trusted < setupCfg.minFaucetBalance) {
        return needMoreBlocks()
      }
    })
  return needMoreBlocks()
}

const stopBitcoind = () => {
  const command = path.join(setupCfg.btcBinDir, 'bitcoin-cli')
  const args = [setupCfg.dataDirArg, 'stop']
  childProcess.spawnSync(command, args)
  console.log('bitcoind stopped')
}

before(async function () {
  this.timeout(60000)
  oscheck()
  if (!fs.existsSync(btcConfigFile.location)) {
    await installBinaries()
    writeConfigFile()
    await startBitcoind()
    await waitForFaucet(20)
    await generateBlocks(101)
  } else {
    writeConfigFile()
    await startBitcoind()
    const walletInfo = await waitForFaucet()
    if (walletInfo.balance < setupCfg.minFaucetBalance) {
      await refillFaucet()
    }
  }
})

after(() => stopBitcoind())

module.exports = { faucetWallet, mainWalletConfig }
