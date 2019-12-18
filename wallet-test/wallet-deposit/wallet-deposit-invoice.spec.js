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

xdescribe('Wallet depositer - invoice', () => {
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
      const addressInfo = await mainWallet.getAddressInfo(addressResponse.address)
      addressInfo.should.have.property('ismine', true)

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
  xit('returns confirmed + unconfirmed invoices from own user', async () => { })
})
