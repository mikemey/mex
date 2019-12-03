const path = require('path')
const fs = require('fs')
const os = require('os')

const download = require('download')
const { startService } = require('@carnesen/bitcoin-service')
const { writeConfigFile } = require('@carnesen/bitcoin-config')
// const Bitcoin = require('bitcoin-core')

const oscheck = () => {
  if (os.platform() !== 'darwin') {
    throw Error('platform not supported:', os.platform())
  }
}

const btcversion = '0.19.0.1'
const regtestDir = path.join(__dirname, '.regtest')

const regtestConfig = {
  dataDir: path.join(regtestDir, 'regtest'),
  binDir: path.join(regtestDir, `bitcoin-${btcversion}`),
  btcBinUrl: `https://bitcoincore.org/bin/bitcoin-core-${btcversion}/bitcoin-${btcversion}-osx64.tar.gz`,
  configFile: path.join(regtestDir, 'regtest.config'),
  btcconfig: {
    rpcauth: '',
    // rpcuser: 'regtester',
    // rpcpassword: 'regtester',
    rpcbind: '127.0.0.1',
    port: 48333,
    rpcport: 48332,
    wallet: 'faucet'
  }
}

const install = () => {
  console.log('installing regtest to', regtestDir)
  fs.mkdirSync(regtestDir)
  return download(regtestConfig.btcBinUrl, regtestDir, { extract: true })
    .then(() => {
      console.log('binary downloaded')
      fs.mkdirSync(regtestConfig.dataDir)
      writeConfigFile(regtestConfig.configFile, {
        datadir: regtestConfig.dataDir,
        regtest: true,
        sections: {
          regtest: regtestConfig.btcconfig
        }
      })
      console.log('created configuration')
    })
}

const startBinary = () => startService(regtestConfig.configFile, regtestConfig.binDir)

const RegtestSetup = () => {
  oscheck()

  const start = () => {
    if (!fs.existsSync(regtestConfig.configFile)) {
      return install().then(startBinary)
    }
    return startBinary()
  }
  const stop = () => Promise.resolve('not yet implemented')
  const getBalance = () => Promise.resolve('not yet implemented')

  return { start, stop, getBalance }
}

// const faucetWallet = new Bitcoin({
//   network: 'regtest',
//   host: connUrl.hostname,
//   username: connUrl.username,
//   password: connUrl.password,
//   port: connUrl.port,
//   wallet: 'faucet'
// })
// return faucetWallet.getNewAddress()
//   .then(address => faucetWallet.command('generatetoaddress', 101, address))
//   .then(result => {
//     console.log('generated!')
//     console.log(result)
//   })

module.exports = RegtestSetup
