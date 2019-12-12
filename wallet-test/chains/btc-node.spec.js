const BitcoinClient = require('bitcoin-core')

const BtcChain = require('../../wallet/chains').getChain('btc')
const { dbconnection } = require('../../utils')

const { startNode, stopNode, faucetWallet, walletConfig, zmqConfig } = require('./btc-node.orch')
const { TestDataSetup: { dbConfig } } = require('../../test-tools')

describe('Btc node', () => {
  const btcNodeTestConfig = {
    client: walletConfig(),
    zmq: zmqConfig,
    db: dbConfig
  }

  before(startNode)
  after(stopNode)

  describe('btc node setup', () => {
    it('regtest faucet has balance', async () => {
      const balance = await faucetWallet.getBalance()
      balance.should.be.at.least(50)
    })
  })

  describe('btw wallet operations', () => {
    let btcNode

    before(async () => { btcNode = await BtcChain.create(btcNodeTestConfig) })
    const addressColl = dbconnection.collection('btc-addresses')

    // const pause = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))

    it('get new address', async () => {
      const newAddress = await btcNode.createNewAddress()

      const mainWallet = new BitcoinClient(walletConfig())
      const addressInfo = await mainWallet.getAddressInfo(newAddress)
      addressInfo.ismine.should.equal(true)

      const storedAddress = await addressColl.findOne({ address: newAddress })
      storedAddress.should.have.property('address', newAddress)
      storedAddress.should.have.deep.property('blocks', [])
    })
  })

  describe('configuration check', () => {
    const testParameters = [
      { title: 'missing client configuration', changeConfig: cfg => delete cfg.client, error: '"client" is required' },
      { title: 'missing zmq configuration', changeConfig: cfg => delete cfg.zmq, error: '"zmq" is required' },
      { title: 'missing db configuration', changeConfig: cfg => delete cfg.db, error: '"db" is required' }
    ]

    testParameters.forEach(params => {
      it(params.title, () => {
        const config = JSON.parse(JSON.stringify(btcNodeTestConfig))
        params.changeConfig(config)
        return BtcChain.create(config)
          .then(() => { throw Error('expected configuration error') })
          .catch(err => err.message.should.equal(params.error))
      })
    })
  })
})
