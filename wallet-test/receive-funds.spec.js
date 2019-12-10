const BitcoinClient = require('bitcoin-core')

const { TestDataSetup: { dropTestDatabase, registeredUser } } = require('../test-tools')
const {
  wsmessages: { OK_STATUS, ERROR_STATUS, withAction },
  dbconnection: { collection, ObjectId }
} = require('../utils')

const {
  startServices, stopServices, wsClient, withJwtMessages, sessionMock, createDepositAddress
} = require('./wallet.orch')

const btcnode = require('./btcnode.orch')

describe('Receiving funds', () => {
  const mexWallet = new BitcoinClient(btcnode.walletConfig())
  const addressColl = collection('addresses')

  const addressMsgs = withJwtMessages('address')
  const regUserAddressReq = () => addressMsgs.build({ symbol: 'btc' })

  before(startServices)
  after(stopServices)
  beforeEach(async () => {
    await dropTestDatabase()
    await createDepositAddress()
  })
  afterEach(() => wsClient.stop())

  describe('requesting address', () => {
    it('generate new address for new user', async () => {
      const testId = '5def654c9ad3f153493e3bbb'
      const testJwt = 'bla-bla-bla-bla-bla-bla'

      const verifyMessages = withAction('verify')
      const verifyReq = verifyMessages.build({ jwt: testJwt })
      const verifyRes = verifyMessages.ok({ user: { id: testId } })
      sessionMock.reset()
      sessionMock.addMockFor(verifyReq, verifyRes)

      const addressReq = withJwtMessages('address', testJwt).build({ symbol: 'btc' })
      const addressResponse = await wsClient.send(addressReq)

      addressResponse.status.should.equal(OK_STATUS)
      addressResponse.action.should.equal('address')

      const addressInfo = await mexWallet.getAddressInfo(addressResponse.address)
      addressInfo.ismine.should.equal(true)

      const storedAddress = await addressColl.findOne({ _id: ObjectId(testId) })
      storedAddress.reserved.should.deep.equal([
        { symbol: 'btc', address: addressResponse.address }
      ])
    })

    it('returns existing address for existing user', async () => {
      const address = 'overwritten-address'
      await addressColl.updateOne({ _id: ObjectId(registeredUser.id) },
        { $set: { reserved: [{ symbol: 'btc', address }] } }
      )
      const addressResponse = await wsClient.send(regUserAddressReq())
      addressResponse.status.should.equal(OK_STATUS)
      addressResponse.address.should.equal(address)
    })

    // it.only('broadcasts address received funding', async () => {
    //   let receivedBroadcast = null
    //   const subscribeRes = await wsClient.subscribe('address-funding', (topic, message) => {
    //     topic.should.equal('address-funding')
    //     receivedBroadcast = message
    //   })
    //   subscribeRes.status.should.equal(OK_STATUS)

    //   const newAddressResponse = await wsClient.send(regUserAddressReq())
    //   const txAmount = '1.2345'
    //   btcnode.createTransaction(newAddressResponse.address, txAmount)
    //   btcnode.generateBlock()

    //   receivedBroadcast.should.deep.equal({
    //     address:
    //   })
    // })
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
    it('empty symbol', () => expectNewAddressError(req => { req.symbol = '' }))
    it('unkown symbol', () => expectNewAddressError(req => { req.symbol = 'ukn' }))
    it('additional request parameters', () => expectNewAddressError(req => { req.additional = 'param' }))
  })
})
