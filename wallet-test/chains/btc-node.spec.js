const BitcoinClient = require('bitcoin-core')

const BtcChain = require('../../wallet/chains').getChain('btc')
const { dbconnection } = require('../../utils')

const { startNode, stopNode, faucetWallet, walletConfig, zmqConfig, generateBlocks } = require('./btc-node.orch')
const { TestDataSetup: { dbConfig, dropTestDatabase } } = require('../../test-tools')

describe('Btc node', () => {
  const btcNodeTestConfig = {
    client: walletConfig(),
    zmq: zmqConfig
  }
  const createBtcNode = (
    { config = btcNodeTestConfig, invoiceCallback = () => { } } = {}
  ) => BtcChain.create(config, invoiceCallback)

  before(startNode)
  after(stopNode)

  describe('btc node setup', () => {
    it('regtest faucet has balance', async () => {
      const balance = await faucetWallet.getBalance()
      balance.should.be.at.least(50)
    })
  })

  describe('btw wallet operations', () => {
    const addressColl = () => dbconnection.collection('btc-addresses')

    before(() => dbconnection.connect(dbConfig))
    beforeEach(dropTestDatabase)
    after(dbconnection.close)

    const pause = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))

    it('get new address', async () => {
      const newAddress = await createBtcNode().createNewAddress()

      const mainWallet = new BitcoinClient(walletConfig())
      const addressInfo = await mainWallet.getAddressInfo(newAddress)
      addressInfo.ismine.should.equal(true)

      const storedAddress = await addressColl().findOne({ address: newAddress })
      storedAddress.should.have.property('address', newAddress)
      storedAddress.should.have.deep.property('blocks', [])
    })

    it.only('monitors new address for blocks', async () => {
      const amount = '1.43256'
      const received = {}
      const invoiceCallback = async (invoice, amount) => {
        received.invoice = invoice
        received.amount = amount
      }
      const address = await createBtcNode({ invoiceCallback }).createNewAddress()
      await faucetWallet.sendToAddress(address, amount)
      await generateBlocks(1)
      await pause(1500)

      received.should.have.property('invoice')
      received.should.have.property('amount', amount)
    })

    xit('monitors multiple stored/new addresses', async () => { })
  })

  describe('configuration check', () => {
    const testParameters = [
      { title: 'missing client configuration', changeConfig: cfg => delete cfg.client, error: '"client" is required' },
      { title: 'missing zmq configuration', changeConfig: cfg => delete cfg.zmq, error: '"zmq" is required' }
    ]

    testParameters.forEach(params => {
      it(params.title, () => {
        const config = JSON.parse(JSON.stringify(btcNodeTestConfig))
        params.changeConfig(config);
        (() => createBtcNode(config)).should.throw(Error, params.error)
      })
    })

    it('throws error if no DB connection', () => {
      (() => createBtcNode(btcNodeTestConfig)).should.throw(Error, 'no db connection available')
    })
  })
})
