const moment = require('moment')

const { TestDataSetup: { dropTestDatabase, registeredUser } } = require('../../test-tools')
const {
  wsmessages: { OK_STATUS },
  units: { fromAmount }
} = require('../../utils')

const {
  startServices, stopServices, wsClient, withJwtMessages,
  chainsOrch: { getChainOrch }
} = require('../wallet.orch')

describe('Wallet depositer - broadcast', () => {
  const { mainWallet, faucetWallet, thirdPartyWallet, generateBlocksWithInfo } = getChainOrch('btc')

  const addressMsgs = withJwtMessages('address')
  const regUserAddressReq = (symbol = 'btc') => addressMsgs.build({ symbol })

  const INVOICE_TOPIC = 'invoices'
  const BLOCKS_TOPIC = 'blocks'

  before(startServices)
  after(stopServices)

  beforeEach(async () => {
    await dropTestDatabase()
    await generateBlocksWithInfo(1)
  })
  afterEach(() => wsClient.unsubscribe(INVOICE_TOPIC, BLOCKS_TOPIC))

  const createInvoice = (amount, blockheight = null) => {
    return {
      _id: { userId: registeredUser.id, symbol: 'btc', invoiceId: undefined },
      date: 'new Date() field - removed during test',
      amount: amount.toBaseUnit(),
      blockheight
    }
  }

  const toExpectedInvoice = ({ _id: { userId, symbol, invoiceId }, date, amount, blockheight }) => {
    return { userId: userId.toString(), symbol, invoiceId, date, amount, blockheight }
  }

  it('unconfirmed + confirmed single invoice from own user', done => {
    (async () => {
      const currentBlockHeight = (await faucetWallet.getBlockchainInformation()).blocks
      const amount = fromAmount('0.12345', 'btc')
      const unconfirmedTx = createInvoice(amount)
      const confirmedTx = createInvoice(amount, currentBlockHeight + 1)

      let expectConfirmedTxs = false
      const subscribeRes = await wsClient.subscribe(INVOICE_TOPIC, (topic, message) => {
        topic.should.equal(INVOICE_TOPIC)
        if (expectConfirmedTxs) {
          const expectedConfirmedResponse = {
            blockheight: currentBlockHeight + 1,
            symbol: 'btc',
            invoices: [confirmedTx].map(toExpectedInvoice)
          }
          checkDateAndRemove(expectedConfirmedResponse, message)
          message.should.deep.equal(expectedConfirmedResponse)
          done()
        } else {
          const expectedUnconfirmedResponse = {
            blockheight: currentBlockHeight,
            symbol: 'btc',
            invoices: [unconfirmedTx].map(toExpectedInvoice)
          }
          checkDateAndRemove(expectedUnconfirmedResponse, message)
          message.should.deep.equal(expectedUnconfirmedResponse)
          expectConfirmedTxs = true
        }
      })
      subscribeRes.status.should.equal(OK_STATUS)

      await addOtherTransactions()

      const userAddressRes = await wsClient.send(regUserAddressReq())
      confirmedTx._id.invoiceId = unconfirmedTx._id.invoiceId =
        await faucetWallet.sendToAddress(userAddressRes.address, amount.toDefaultUnit())
      await generateBlocksWithInfo(1)
    })().catch(done)
  }).timeout(10000)

  it('unconfirmed + confirmed multiple invoices from own user', done => {
    (async () => {
      const currentBlockHeight = (await faucetWallet.getBlockchainInformation()).blocks
      const nextBlockHeight = currentBlockHeight + 1
      const amount1 = fromAmount('0.12345', 'btc')
      const amount2 = fromAmount('9.8765', 'btc')

      const unconfirmedTx1 = createInvoice(amount1)
      const unconfirmedTx2 = createInvoice(amount2)

      const confirmedTx1 = createInvoice(amount1, nextBlockHeight)
      const confirmedTx2 = createInvoice(amount2, nextBlockHeight)

      let callbackCount = 0
      await wsClient.subscribe(INVOICE_TOPIC, (topic, message) => {
        topic.should.equal(INVOICE_TOPIC)
        callbackCount += 1
        const isFirstTxFirst = message.invoices[0].invoiceId === confirmedTx1._id.invoiceId

        if (callbackCount < 3) {
          const invoices = (isFirstTxFirst ? [unconfirmedTx1] : [unconfirmedTx2])
            .map(toExpectedInvoice)
          const expectedInvoices = {
            blockheight: currentBlockHeight,
            symbol: 'btc',
            invoices
          }
          checkDateAndRemove(expectedInvoices, message)
          message.should.deep.equal(expectedInvoices)
        } else {
          const invoices = (isFirstTxFirst ? [confirmedTx1, confirmedTx2] : [confirmedTx2, confirmedTx1])
            .map(toExpectedInvoice)
          const expectedBlockInvoices = {
            blockheight: nextBlockHeight,
            symbol: 'btc',
            invoices
          }
          checkDateAndRemove(expectedBlockInvoices, message)
          message.should.deep.equal(expectedBlockInvoices)
          done()
        }
      })

      const userAddressRes = await wsClient.send(regUserAddressReq())
      unconfirmedTx1._id.invoiceId = confirmedTx1._id.invoiceId =
        await faucetWallet.sendToAddress(userAddressRes.address, amount1.toDefaultUnit())

      await addOtherTransactions()
      unconfirmedTx2._id.invoiceId = confirmedTx2._id.invoiceId =
        await faucetWallet.sendToAddress(userAddressRes.address, amount2.toDefaultUnit())
      await addOtherTransactions()

      await generateBlocksWithInfo(1)
    })().catch(done)
  }).timeout(10000)

  const checkDateAndRemove = (expected, message) => {
    message.invoices.forEach(invoice => {
      const hasValidDate = (invoice.date && moment(invoice.date).isValid()) === true
      hasValidDate.should.equal(true)
      delete invoice.date
    })
    expected.invoices.forEach(invoice => {
      delete invoice.date
    })
  }

  const addOtherTransactions = () => Promise.all([
    [faucetWallet, thirdPartyWallet, '1.1'],
    [thirdPartyWallet, faucetWallet, '0.3'],
    [faucetWallet, mainWallet, '1.3'],
    [mainWallet, faucetWallet, '0.3'],
    [thirdPartyWallet, mainWallet, '0.5'],
    [mainWallet, thirdPartyWallet, '0.5']
  ].map(async ([sender, receiver, btcs]) => {
    const addr = await receiver.getNewAddress()
    await sender.sendToAddress(addr, btcs)
  }))

  it('broadcasts new blocks', done => {
    (async () => {
      const currentBlockHeight = (await faucetWallet.getBlockchainInformation()).blocks
      const subscribeRes = await wsClient.subscribe(BLOCKS_TOPIC, (topic, message) => {
        topic.should.equal(BLOCKS_TOPIC)
        message.should.deep.equal({ symbol: 'btc', blockheight: currentBlockHeight + 1 })
        done()
      })
      subscribeRes.status.should.equal(OK_STATUS)

      const userAddressRes = await wsClient.send(regUserAddressReq())
      await faucetWallet.sendToAddress(userAddressRes.address, '3.2')
      await generateBlocksWithInfo(1)
    })().catch(done)
  })
})
