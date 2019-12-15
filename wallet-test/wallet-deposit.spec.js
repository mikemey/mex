const { TestDataSetup: { dropTestDatabase, registeredUser } } = require('../test-tools')
const {
  wsmessages: { OK_STATUS, ERROR_STATUS, withAction },
  dbconnection: { collection, ObjectId }
} = require('../utils')

const {
  startServices, stopServices, wsClient, withJwtMessages, sessionMock
} = require('./wallet.orch')

describe.only('Wallet depositer', () => {
  const addressColl = collection('addresses')

  const addressMsgs = withJwtMessages('address')
  const regUserAddressReq = () => addressMsgs.build({ symbol: 'btc' })

  before(startServices)
  after(stopServices)
  beforeEach(dropTestDatabase)
  afterEach(() => wsClient.stop())

  describe('requesting address', () => {
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

      const storedAddresses = await addressColl.findOne({ _id: ObjectId(testUserId) })
      storedAddresses.assets.should.deep.equal([
        { symbol: 'btc', address: addressResponse.address }
      ])
    })

    it('returns existing address for existing user', async () => {
      const address = 'testing-address'
      await addressColl.insertOne({
        _id: ObjectId(registeredUser.id),
        assets: [{ symbol: 'btc', address }]
      })
      const addressResponse = await wsClient.send(regUserAddressReq())
      addressResponse.status.should.equal(OK_STATUS)
      addressResponse.address.should.equal(address)
    })

    // it('broadcasts address received funding', async () => {
    //   const receivedBroadcast = []
    //   let broadcastCount = 0
    //   const subscribeRes = await wsClient.subscribe('address-funding', (topic, message) => {
    //     broadcastCount += 1
    //     topic.should.equal('address-funding')
    //     receivedBroadcast.push(message)
    //   })
    //   subscribeRes.status.should.equal(OK_STATUS)

    //   const res = await wsClient.send(regUserAddressReq())
    //   console.log('address RESPONSE:')
    //   console.log(res)
    //   const address = res.address
    //   const firstTxAmount = '1.23'
    //   await sendAndConfirmTx(address, firstTxAmount)
    //   await pause(1500)
    //   broadcastCount.should.equal(1)
    //   receivedBroadcast.should.deep.equal([{ address, amount: firstTxAmount }])

    //   const secondTxAmount = '0.23'
    //   await sendAndConfirmTx(address, secondTxAmount)
    //   broadcastCount.should.equal(2)
    //   receivedBroadcast.should.deep.equal([
    //     { address, amount: firstTxAmount },
    //     { address, amount: secondTxAmount }
    //   ])
    // }, 30000)
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
})
