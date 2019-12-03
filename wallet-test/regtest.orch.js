const childProcess = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const download = require('download')
const BitcoinClient = require('bitcoin-core')

const oscheck = () => {
  if (os.platform() !== 'darwin') {
    throw Error('platform not supported:', os.platform())
  }
}

const btcversion = '0.19.0.1'
const regtestDir = path.join(__dirname, '.regtest')

const regtestConfig = {
  btcBinUrl: `https://bitcoincore.org/bin/bitcoin-core-${btcversion}/bitcoin-${btcversion}-osx64.tar.gz`,
  btcBinDir: path.join(regtestDir, `bitcoin-${btcversion}`),
  btcProcess: null
}

const btcConfigFile = {
  location: path.join(regtestDir, 'regtest.config'),
  content: {
    datadir: regtestDir,
    regtest: 1,
    daemon: 1,
    sections: {
      regtest: {
        rpcauth: 'regtester:a1c4c0cf083f71dc25d230298beab0a9$479765cb0999b734931ddfe4ac0a5b6245ff6ebd13a36d675432ea88817e5d7f',
        // rpcauth: 'regtester:regtester',
        rpcbind: '127.0.0.1',
        port: 36963,
        // rpcbind: 'localhost',
        rpcport: 24842,
        wallet: 'faucet'
      }
    }
  }
}

const keyValuePair = obj => Object.keys(obj).map(key => `${key}=${obj[key]}`)

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

const btcClientConfig = {
  network: 'regtest',
  // host: btcConfigFile.content.sections.regtest.rpcbind,
  host: 'localhost',
  port: btcConfigFile.content.sections.regtest.rpcport,
  username: 'regtester',
  password: 'regtester'
}

const install = () => {
  console.log('installing regtest to', regtestDir)
  fs.mkdirSync(regtestDir)
  return download(regtestConfig.btcBinUrl, regtestDir, { extract: true })
}

const startBitcoind = () => new Promise((resolve, reject) => {
  const command = path.join(regtestConfig.btcBinDir, 'bin', 'bitcoind')
  const args = [`-conf=${btcConfigFile.location}`]
  regtestConfig.btcProcess = childProcess.spawn(command, args, { stdio: 'ignore' })

  regtestConfig.btcProcess.on('error', reject)
  regtestConfig.btcProcess.on('exit', code => {
    if (code === 0) { return resolve() }
    reject(new Error(`bitcoind start failed: ${code}`))
  })

  setTimeout(reject, 1000, Error('bitcoind start timed out'))
})

const RegtestSetup = () => {
  oscheck()

  async function start () {
    if (!fs.existsSync(btcConfigFile.location)) {
      await install()
    }
    writeConfigFile()
    await startBitcoind()
  }

  const stop = () => { }
  const faucetWallet = new BitcoinClient(Object.assign({ wallet: 'faucet' }, btcClientConfig))

  const getBalance = () => faucetWallet.getBalance()

  return { start, stop, getBalance }
}

// return faucetWallet.getNewAddress()
//   .then(address => faucetWallet.command('generatetoaddress', 101, address))
//   .then(result => {
//     console.log('generated!')
//     console.log(result)
//   })

module.exports = RegtestSetup
