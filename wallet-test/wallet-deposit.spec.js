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

describe('Wallet depositer', () => {
  const addressColl = collection('addresses')

  const addressMsgs = withJwtMessages('address')
  const regUserAddressReq = (symbol = 'btc') => addressMsgs.build({ symbol })

  before(startServices)
  after(stopServices)

  describe('requesting address', () => {
    beforeEach(dropTestDatabase)

    it('generate new address for new user', async () => {
      const testUserId = '5def654c9ad3f153493e3bbb'
      const testJwt = 'bla-bla-bla-bla-bla-bla'

      const verifyMessages = withAction('verify')
      const verifyReq = verifyMessages.build({ jwt: testJwt })
      const verifyRes = verifyMessages.ok({ user: { id: testUserId } })
      sessionMock.reset()
      sessionMock.addMockFor(verifyReq, verifyRes)

      const addressReq = withJwtMessages('address', testJwt).build({ symbol: 'btc' })
      const addressResponse = await wsClient.send(addressReq)

      addressResponse.status.should.equal(OK_STATUS)
      addressResponse.action.should.equal('address')

      const storedAddress = await addressColl.find({ _id: ObjectId(testUserId) }).toArray()
      storedAddress.should.deep.equal([
        { _id: ObjectId(testUserId), symbol: 'btc', address: addressResponse.address }
      ])
    })

    it('returns existing address for registered user', async () => {
      const address = 'testing-address'
      await addressColl.insertOne(
        { _id: ObjectId(registeredUser.id), symbol: 'btc', address }
      )
      const addressResponse = await wsClient.send(regUserAddressReq())
      addressResponse.status.should.equal(OK_STATUS)
      addressResponse.address.should.equal(address)
    })

    it('returns error for unknown asset', async () => {
      const addressResponse = await wsClient.send(regUserAddressReq('unknown'))
      addressResponse.status.should.equal(ERROR_STATUS)
      addressResponse.should.not.have.property('address')
    })
  })

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

  describe('client errors', () => {
    const expectNewAddressError = async (changeReq = _ => { }) => {
      const req = regUserAddressReq()
      changeReq(req)
      const res = await wsClient.send(req)
      const errorMessage = Object.assign({
        user: { id: registeredUser.id, email: registeredUser.email }
      }, req)
      delete errorMessage.jwt
      res.should.deep.equal({ status: ERROR_STATUS, message: errorMessage })
    }

    it('missing action parameter', () => expectNewAddressError(req => { delete req.action }))
    it('invalid action', () => expectNewAddressError(req => { req.action = 'addressX' }))
    it('missing action parameter', () => expectNewAddressError(req => { delete req.action }))
    it('empty asset', () => expectNewAddressError(req => { req.asset = '' }))
    it('unkown asset', () => expectNewAddressError(req => { req.asset = 'ukn' }))
    it('additional request parameters', () => expectNewAddressError(req => { req.additional = 'param' }))
  })

  describe('future tests', () => {
    xit('ensure collection indices', async () => { })
    xit('returns confirmed + unconfirmed invoices from own user', async () => { })
  })
})
