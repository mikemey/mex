const BtcAdapter = require('../../wallet/chains/btc-adapter')

const {
  startNode, stopNode,
  mainWallet, faucetWallet, thirdPartyWallet,
  generateBlocks, defaultBtcAdapterConfig
} = require('./btc-node.orch')

const { units: { amountFrom } } = require('../../utils')

describe('Btc adapter', () => {
  const btcAdapter = BtcAdapter.create(defaultBtcAdapterConfig)

  before(startNode)
  after(stopNode)

  describe('btc node setup', () => {
    it('regtest faucet has balance', async () => {
      const balance = await faucetWallet.getBalance()
      balance.should.be.at.least(50)
    })
  })

  describe('btc wallet operations', () => {
    afterEach(() => {
      btcAdapter.stopListener()
      return generateBlocks(1)
    })

    const expectReceivedInvoices = (blockheight, expectCount, expectInvoices, done) => invoiceRes => {
      if (invoiceRes.type === 'invoices') {
        invoiceRes.blockheight.should.equal(blockheight)
        invoiceRes.invoices.should.have.length(expectCount)
        expectInvoices.forEach(invoice => invoiceRes.invoices.should.deep.include(invoice))
        done()
      }
    }

    it('get new address', async () => {
      btcAdapter.startListener()
      const newAddress = await btcAdapter.createNewAddress()

      const addressInfo = await mainWallet.getAddressInfo(newAddress)
      addressInfo.ismine.should.equal(true)
    })

    it('reports invoice from new mempool transaction', done => {
      (async () => {
        const currentBlockHeight = (await faucetWallet.getBlockchainInformation()).blocks
        const address = await btcAdapter.createNewAddress()
        const amount = amountFrom('2.22222', 'btc')
        const expectedInvoice = { invoiceId: undefined, address, amount: amount.toBaseUnit(), blockheight: null }

        btcAdapter.startListener(expectReceivedInvoices(currentBlockHeight, 2, [expectedInvoice], done))
        expectedInvoice.invoiceId = await faucetWallet.sendToAddress(address, amount.toDefaultUnit())
      })().catch(done)
    })

    it('reports invoices from new block', done => {
      (async () => {
        const nextBlockHeight = 1 + (await faucetWallet.getBlockchainInformation()).blocks

        const myAddress = await btcAdapter.createNewAddress()
        const myAmount = amountFrom('2.22222', 'btc')
        const myInvoiceId = await faucetWallet.sendToAddress(myAddress, myAmount.toDefaultUnit())
        const myexpectedInvoice = { invoiceId: myInvoiceId, address: myAddress, amount: myAmount.toBaseUnit(), blockheight: nextBlockHeight }

        const otherAddress = await thirdPartyWallet.getNewAddress()
        const otherAmount = amountFrom('1.111', 'btc')
        const otherInvoiceId = await faucetWallet.sendToAddress(otherAddress, otherAmount.toDefaultUnit())
        const expectedOtherInvoice = {
          invoiceId: otherInvoiceId, address: otherAddress, amount: otherAmount.toBaseUnit(), blockheight: nextBlockHeight
        }

        const expectedInvoices = [myexpectedInvoice, expectedOtherInvoice]
        btcAdapter.startListener(expectReceivedInvoices(nextBlockHeight, 5, expectedInvoices, done))
        await generateBlocks(1)
      })().catch(done)
    })

    it('consecutive calls to stopListener are no-ops', async () => {
      btcAdapter.stopListener()
      await btcAdapter.startListener()
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
