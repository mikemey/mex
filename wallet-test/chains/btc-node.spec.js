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
    const pause = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))

    it('get new address', async () => {
      const newAddress = await startBtcNode().createNewAddress()

      const mainWallet = new BitcoinClient(walletConfig())
      const addressInfo = await mainWallet.getAddressInfo(newAddress)
      addressInfo.ismine.should.equal(true)
    })

    it('reports invoice from new mempool transaction', async () => {
      const testAmount = '1.43256'
      let received = null
      const newTransactionCb = async invoice => { received = invoice }
      const address = await startBtcNode({ newTransactionCb }).createNewAddress()
      const expectedInvoiceId = await faucetWallet.sendToAddress(address, testAmount)
      await pause(30)

      received.invoiceId.should.equal(expectedInvoiceId)
      received.outputs.should.have.length(2)
      const txoutput = received.outputs.find(out => out.address === address)
      txoutput.amount.should.equal(testAmount)
    })

    it('reports invoices from new block', async () => {
      const blockHeight = (await faucetWallet.getBlockchainInformation()).blocks
      const testAmount = '2.222222'
      const thirdPartyAmount = '1'
      let received = null
      const newBlockCb = async invoices => { received = invoices }
      const mexaddress = await startBtcNode({ newBlockCb }).createNewAddress()
      const mexTxid = await faucetWallet.sendToAddress(mexaddress, testAmount)

      const thirdPartyAddr = await thirdPartyWallet.getNewAddress()
      const thirdPartyTxid = await faucetWallet.sendToAddress(thirdPartyAddr, thirdPartyAmount)
      await generateBlocks(1)

      await pause(30)
      received.should.have.length(5)
      received.should.deep.include(
        { invoiceId: mexTxid, address: mexaddress, amount: testAmount, block: blockHeight + 1 }
      )
      received.should.deep.include(
        { invoiceId: thirdPartyTxid, address: thirdPartyAddr, amount: thirdPartyAmount, block: blockHeight + 1 }
      )
    })
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
        (() => startBtcNode({ config })).should.throw(Error, params.error)
      })
    })
  })
})
