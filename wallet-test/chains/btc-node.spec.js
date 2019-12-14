const BitcoinClient = require('bitcoin-core')

const BtcChain = require('../../wallet/chains').getChain('btc')

const { startNode, stopNode, faucetWallet, thirdPartyWallet, defaultBtcNodeConfig, walletConfig, generateBlocks } = require('./btc-node.orch')

describe('Btc node', () => {
  let testBtcNode

  const startBtcNode = ({
    config = defaultBtcNodeConfig, newTransactionCb = () => { }, newBlockCb = () => { }
  } = {}) => {
    testBtcNode = BtcChain.start(config, newTransactionCb, newBlockCb)
    return testBtcNode
  }

  before(startNode)
  after(stopNode)
  beforeEach(() => { testBtcNode = null })
  afterEach(() => {
    if (testBtcNode) { testBtcNode.stop() }
    return clearMempool()
  })

  const clearMempool = async () => generateBlocks(1)

  describe('btc node setup', () => {
    it('regtest faucet has balance', async () => {
      const balance = await faucetWallet.getBalance()
      balance.should.be.at.least(50)
    })
  })

  describe('btw wallet operations', () => {
    it('get new address', async () => {
      const newAddress = await startBtcNode().createNewAddress()

      const mainWallet = new BitcoinClient(walletConfig())
      const addressInfo = await mainWallet.getAddressInfo(newAddress)
      addressInfo.ismine.should.equal(true)
    })

    it('reports invoice from new mempool transaction', done => {
      const intx = { invoiceId: null, address: null, amount: '1.43256' }

      const newTransactionCb = async invoices => new Promise((resolve, reject) => {
        invoices.should.have.length(2)
        invoices.should.deep.include(intx)
        resolve()
      }).then(done).catch(done);

      (async () => {
        intx.address = await startBtcNode({ newTransactionCb }).createNewAddress()
        intx.invoiceId = await faucetWallet.sendToAddress(intx.address, intx.amount)
      })().catch(done)
    })

    it('reports invoices from new block', done => {
      const intxs = {
        mex: { invoiceId: null, address: null, amount: '2.22222', block: null },
        other: { invoiceId: null, address: null, amount: '1.111', block: null }
      }
      const newBlockCb = async invoices => new Promise((resolve, reject) => {
        invoices.should.have.length(5)
        invoices.should.deep.include(intxs.mex)
        invoices.should.deep.include(intxs.other)
        resolve()
      }).then(done).catch(done);

      (async () => {
        intxs.mex.block = intxs.other.block = 1 + (await faucetWallet.getBlockchainInformation()).blocks
        intxs.mex.address = await startBtcNode({ newBlockCb }).createNewAddress()
        intxs.mex.invoiceId = await faucetWallet.sendToAddress(intxs.mex.address, intxs.mex.amount)

        intxs.other.address = await thirdPartyWallet.getNewAddress()
        intxs.other.invoiceId = await faucetWallet.sendToAddress(intxs.other.address, intxs.other.amount)
        await generateBlocks(1)
      })().catch(done)
    })
  })

  describe('configuration check', () => {
    const testParameters = [
      { title: 'missing client configuration', changeConfig: cfg => delete cfg.client, error: '"client" is required' },
      { title: 'missing zmq configuration', changeConfig: cfg => delete cfg.zmq, error: '"zmq" is required' }
    ]

    testParameters.forEach(params => {
      it(params.title, () => {
        const config = JSON.parse(JSON.stringify(defaultBtcNodeConfig))
        params.changeConfig(config);
        (() => startBtcNode({ config })).should.throw(Error, params.error)
      })
    })
  })
})
