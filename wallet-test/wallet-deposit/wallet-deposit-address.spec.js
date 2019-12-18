const { TestDataSetup: { dropTestDatabase, registeredUser } } = require('../../test-tools')
const {
  wsmessages: { OK_STATUS, ERROR_STATUS, withAction },
  dbconnection: { collection, ObjectId },
  units: { Satoshi }
} = require('../../utils')

const {
  startServices, stopServices, wsClient, withJwtMessages, sessionMock,
  btcnodeOrch: { mainWallet, faucetWallet, thirdPartyWallet, generateBlocks },
  setSessionMockUser
} = require('../wallet.orch')

describe('Wallet depositer - general/address', () => {
  const addressColl = collection('addresses')

  const addressMsgs = withJwtMessages('address')
  const regUserAddressReq = (symbol = 'btc') => addressMsgs.build({ symbol })

  before(startServices)
  after(stopServices)

  describe('requesting address', () => {
    beforeEach(dropTestDatabase)

    it('generate new address for new user', async () => {
      const testUserId = '5def654c9ad3f153493e3bbb'
      sessionMock.reset()
      setSessionMockUser({ id: testUserId })
      const addressResponse = await wsClient.send(regUserAddressReq())

      addressResponse.status.should.equal(OK_STATUS)
      addressResponse.action.should.equal('address')
      const addressInfo = await mainWallet.getAddressInfo(addressResponse.address)
      addressInfo.should.have.property('ismine', true)

      const recordId = { userId: ObjectId(testUserId), symbol: 'btc' }
      const storedAddress = await addressColl.find({ _id: recordId }).toArray()
      storedAddress.should.deep.equal([
        { _id: recordId, address: addressResponse.address }
      ])
    })

    it('returns existing address for registered user', async () => {
      const address = 'testing-address'
      const wrong = 'wrong-testing-address'
      await addressColl.insertMany([
        { _id: { userId: ObjectId(registeredUser.id), symbol: 'btc' }, wrong },
        { _id: { userId: ObjectId(registeredUser.id), symbol: 'eth' }, address },
        { _id: { userId: 'other-id', symbol: 'eth' }, wrong }
      ])
      const addressResponse = await wsClient.send(regUserAddressReq('eth'))
      addressResponse.status.should.equal(OK_STATUS)
      addressResponse.address.should.equal(address)
    })

    it('returns error for unknown asset', async () => {
      const addressResponse = await wsClient.send(regUserAddressReq('unknown'))
      addressResponse.status.should.equal(ERROR_STATUS)
      addressResponse.should.not.have.property('address')
    })
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
  })
})
