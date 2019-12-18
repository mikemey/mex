const { TestDataSetup: { dropTestDatabase, registeredUser } } = require('../test-tools')
const {
  wsmessages: { OK_STATUS, ERROR_STATUS, withAction },
  dbconnection: { collection, ObjectId },
  units: { Satoshi }
} = require('../utils')

const {
  startServices, stopServices, wsClient, withJwtMessages, sessionMock,
  btcnodeOrch: { mainWallet, faucetWallet, thirdPartyWallet, generateBlocks }
} = require('./wallet.orch')

xdescribe('Wallet depositer - broadcast', () => {
  const addressColl = collection('addresses')

  const addressMsgs = withJwtMessages('address')
  const regUserAddressReq = (symbol = 'btc') => addressMsgs.build({ symbol })

  before(startServices)
  after(stopServices)

  describe('broadcasts', () => {
    beforeEach(async () => {
      await generateBlocks(1)
      await dropTestDatabase()
    })

    it('unconfirmed + confirmed invoices from own user', done => {
      (async () => {
        const currentBlockHeight = (await faucetWallet.getBlockchainInformation()).blocks
        const amount = Satoshi.fromBtcValue('0.12345')
        const expectedResponse = {
          blockheight: currentBlockHeight,
          invoices: [
            {
              _id: registeredUser.id,
              symbol: 'btc',
              invoiceId: undefined,
              amount: amount.toString(),
              blockheight: null
            }
          ]
        }
        const userAddressRes = await wsClient.send(regUserAddressReq())

        let expectConfirmedTxs = false
        const subscribeRes = await wsClient.subscribe('deposits', (topic, message) => {
          topic.should.equal('deposits')
          if (expectConfirmedTxs) {
            expectedResponse.blockheight = expectedResponse.invoices[0].blockheight = currentBlockHeight + 1
            message.should.deep.equal(expectedResponse)
            done()
          } else {
            message.should.deep.equal(expectedResponse)
            expectConfirmedTxs = true
          }
        })
        subscribeRes.status.should.equal(OK_STATUS)

        await addOtherTransactions()
        expectedResponse.invoices[0].invoiceId =
          await faucetWallet.sendToAddress(userAddressRes.address, amount.toBtc())
        await generateBlocks(1)
      })().catch(done)
    }).timeout(5000)

    const addOtherTransactions = () => Promise.all([
      [faucetWallet, thirdPartyWallet, '1.1'],
      [thirdPartyWallet, faucetWallet, '0.3'],
      [faucetWallet, mainWallet, '1.3'],
      [mainWallet, faucetWallet, '0.3'],
      [thirdPartyWallet, mainWallet, '0.5'],
      [mainWallet, thirdPartyWallet, '0.5']
    ].map(async ([sender, receiver, btcs], ix) => {
      const addr = await receiver.getNewAddress()
      await sender.sendToAddress(addr, btcs)
    }))
  })
})
