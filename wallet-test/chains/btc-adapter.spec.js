const BitcoinClient = require('bitcoin-core')

const BtcAdapter = require('../../wallet/chains/btc-adapter')

const { startNode, stopNode, faucetWallet, thirdPartyWallet, defaultBtcAdapterConfig, walletConfig, generateBlocks } = require('./btc-node.orch')

describe('Btc adapter', () => {
  const btcAdapter = BtcAdapter.create(defaultBtcAdapterConfig)

  before(startNode)
  after(stopNode)

  const clearMempool = async () => generateBlocks(1)

  describe('btc node setup', () => {
    it('regtest faucet has balance', async () => {
      const balance = await faucetWallet.getBalance()
      balance.should.be.at.least(50)
    })
  })

  describe('btw wallet operations', () => {
    afterEach(() => {
      btcAdapter.stopListener()
      return clearMempool()
    })

    it('get new address', async () => {
      btcAdapter.startListener()
      const newAddress = await btcAdapter.createNewAddress()

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
        btcAdapter.startListener({ newTransactionCb })
        intx.address = await btcAdapter.createNewAddress()
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
        btcAdapter.startListener({ newBlockCb })
        intxs.mex.address = await btcAdapter.createNewAddress()
        intxs.mex.invoiceId = await faucetWallet.sendToAddress(intxs.mex.address, intxs.mex.amount)

        intxs.other.address = await thirdPartyWallet.getNewAddress()
        intxs.other.invoiceId = await faucetWallet.sendToAddress(intxs.other.address, intxs.other.amount)
        await generateBlocks(1)
      })().catch(done)
    })

    it('consecutive calls to stopListener are no-ops', () => {
      btcAdapter.stopListener()
      btcAdapter.stopListener()
      btcAdapter.startListener()
      btcAdapter.stopListener()
      btcAdapter.stopListener()
    })
  })

  describe('configuration check', () => {
    const testParameters = [
      { title: 'missing client configuration', changeConfig: cfg => delete cfg.client, error: '"client" is required' },
      { title: 'missing zmq configuration', changeConfig: cfg => delete cfg.zmq, error: '"zmq" is required' }
    ]

    testParameters.forEach(params => {
      it(params.title, () => {
        const config = JSON.parse(JSON.stringify(defaultBtcAdapterConfig))
        params.changeConfig(config);
        (() => BtcAdapter.create(config)).should.throw(Error, params.error)
      })
    })
  })
})
