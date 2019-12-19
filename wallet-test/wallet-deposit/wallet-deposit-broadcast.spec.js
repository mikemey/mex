const moment = require('moment')

const { TestDataSetup: { dropTestDatabase, registeredUser } } = require('../../test-tools')
const {
  wsmessages: { OK_STATUS },
  units: { Satoshi }
} = require('../../utils')

const {
  startServices, stopServices, wsClient, withJwtMessages,
  btcnodeOrch: { mainWallet, faucetWallet, thirdPartyWallet, generateBlocks }
} = require('../wallet.orch')

describe('Wallet depositer - broadcast', () => {
  const addressMsgs = withJwtMessages('address')
  const regUserAddressReq = (symbol = 'btc') => addressMsgs.build({ symbol })

  before(startServices)
  after(stopServices)

  beforeEach(async () => {
    await dropTestDatabase()
    await generateBlocks(1)
  })

  const createInvoice = (amount, blockheight = null) => {
    return {
      _id: { userId: registeredUser.id, symbol: 'btc', invoiceId: undefined },
      date: 'new Date() field - removed during test',
      amount: amount.toString(),
      blockheight
    }
  }

  it('unconfirmed + confirmed single invoice from own user', done => {
    (async () => {
      const currentBlockHeight = (await faucetWallet.getBlockchainInformation()).blocks
      const amount = Satoshi.fromBtcValue('0.12345')
      const unconfirmedTx = createInvoice(amount)
      const expectedUnconfirmedResponse = {
        blockheight: currentBlockHeight,
        invoices: [unconfirmedTx]
      }
      const confirmedTx = createInvoice(amount, currentBlockHeight + 1)
      const expectedConfirmedResponse = {
        blockheight: currentBlockHeight + 1,
        invoices: [confirmedTx]
      }

      let expectConfirmedTxs = false
      const subscribeRes = await wsClient.subscribe('deposits', (topic, message) => {
        topic.should.equal('deposits')
        if (expectConfirmedTxs) {
          checkDateAndRemove(expectedConfirmedResponse, message)
          message.should.deep.equal(expectedConfirmedResponse)
          done()
        } else {
          checkDateAndRemove(expectedUnconfirmedResponse, message)
          message.should.deep.equal(expectedUnconfirmedResponse)
          expectConfirmedTxs = true
        }
      })
      subscribeRes.status.should.equal(OK_STATUS)

      await addOtherTransactions()

      const userAddressRes = await wsClient.send(regUserAddressReq())
      confirmedTx._id.invoiceId = unconfirmedTx._id.invoiceId =
        await faucetWallet.sendToAddress(userAddressRes.address, amount.toBtc())
      await generateBlocks(1)
    })().catch(done)
  }).timeout(10000)

  it('unconfirmed + confirmed multiple invoices from own user', done => {
    (async () => {
      const currentBlockHeight = (await faucetWallet.getBlockchainInformation()).blocks
      const nextBlockHeight = currentBlockHeight + 1
      const amount1 = Satoshi.fromBtcValue('0.12345')
      const amount2 = Satoshi.fromBtcValue('9.8765')

      const unconfirmedTx1 = createInvoice(amount1)
      const unconfirmedTx2 = createInvoice(amount2)

      const confirmedTx1 = createInvoice(amount1, nextBlockHeight)
      const confirmedTx2 = createInvoice(amount2, nextBlockHeight)

      let callbackCount = 0
      await wsClient.subscribe('deposits', (topic, message) => {
        topic.should.equal('deposits')
        callbackCount += 1
        const isFirstTxFirst = message.invoices[0]._id.invoiceId === confirmedTx1._id.invoiceId

        if (callbackCount < 3) {
          const expectedInvoices = {
            blockheight: currentBlockHeight,
            invoices: isFirstTxFirst ? [unconfirmedTx1] : [unconfirmedTx2]
          }
          checkDateAndRemove(expectedInvoices, message)
          message.should.deep.equal(expectedInvoices)
        } else {
          const expectedBlockInvoices = {
            blockheight: nextBlockHeight,
            invoices: isFirstTxFirst ? [confirmedTx1, confirmedTx2] : [confirmedTx2, confirmedTx1]
          }
          checkDateAndRemove(expectedBlockInvoices, message)
          message.should.deep.equal(expectedBlockInvoices)
          done()
        }
      })

      const userAddressRes = await wsClient.send(regUserAddressReq())
      unconfirmedTx1._id.invoiceId = confirmedTx1._id.invoiceId =
        await faucetWallet.sendToAddress(userAddressRes.address, amount1.toBtc())

      await addOtherTransactions()
      unconfirmedTx2._id.invoiceId = confirmedTx2._id.invoiceId =
        await faucetWallet.sendToAddress(userAddressRes.address, amount2.toBtc())
      await addOtherTransactions()

      await generateBlocks(1)
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
})
