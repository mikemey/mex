const BitcoinClient = require('bitcoin-core')

const BtcChain = require('../../wallet/chains').getChain('btc')

const { startNode, stopNode, faucetWallet, thirdPartyWallet, walletConfig, zmqConfig, generateBlocks } = require('./btc-node.orch')

describe('Btc node', () => {
  let testBtcNode
  const btcNodeTestConfig = {
    client: walletConfig(),
    zmq: zmqConfig
  }
  const startBtcNode = ({
    config = btcNodeTestConfig, newTransactionCb = () => { }, newBlockCb = () => { }
  } = {}) => {
    testBtcNode = BtcChain.start(config, newTransactionCb, newBlockCb)
    return testBtcNode
  }

  before(startNode)
  after(stopNode)
  beforeEach(() => { testBtcNode = null })
  afterEach(() => {
    if (testBtcNode) { testBtcNode.stop() }
  })

  describe('btc node setup', () => {
    it('regtest faucet has balance', async () => {
      const balance = await faucetWallet.getBalance()
      balance.should.be.at.least(50)
    })
  })

  describe('btw wallet operations', () => {
    const pause = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))

    it('get new address', async () => {
      const newAddress = await startBtcNode().createNewAddress()

      const mainWallet = new BitcoinClient(walletConfig())
      const addressInfo = await mainWallet.getAddressInfo(newAddress)
      addressInfo.ismine.should.equal(true)
    })

    it('reports invoice from new transaction', async () => {
      const testAmount = '1.43256'
      let received = null
      const newTransactionCb = async invoice => { received = invoice }
      const address = await startBtcNode({ newTransactionCb }).createNewAddress()
      const expectedInvoiceId = await faucetWallet.sendToAddress(address, testAmount)
      await pause(20)

      received.invoiceId.should.equal(expectedInvoiceId)
      received.outputs.should.have.length(2)
      const txoutput = received.outputs.find(out => out.address === address)
      txoutput.amount.should.equal(testAmount)
    })

    it.only('reports invoice from new block', async () => {
      const blockHeight = (await faucetWallet.getBlockchainInformation()).blocks
      const testAmount = '1'
      let received = null
      const newBlockCb = async invoices => { received = invoices }
      await startBtcNode({ newBlockCb })

      const thirdPartyAddr = await thirdPartyWallet.getNewAddress()
      const otherTxid = await faucetWallet.sendToAddress(thirdPartyAddr, testAmount)
      await generateBlocks(1)
      await pause(500)
      received.should.have.length(2)
      const thirdPartyInvoice = received.find(invoice => invoice.invoiceId === otherTxid)
      thirdPartyInvoice.address.should.equal(thirdPartyAddr)
      thirdPartyInvoice.amount.should.equal(testAmount)
      thirdPartyInvoice.block.should.equal(blockHeight + 1)
    })

    xit('reports multiple addresses from transactions + blocks', async () => { })
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
        (() => startBtcNode(config)).should.throw(Error, params.error)
      })
    })
  })
})
