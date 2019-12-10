const BitcoinClient = require('bitcoin-core')

const { startServices, stopServices, wsClient, withJwtMessages } = require('./wallet.orch')
const { walletConfig } = require('./btcnode.orch')
const { wsmessages: { OK_STATUS, ERROR_STATUS } } = require('../utils')

describe('Receiving funds', () => {
  const mexWallet = new BitcoinClient(walletConfig())

  before(startServices)
  after(stopServices)
  afterEach(() => wsClient.stop())

  const addressMsgs = withJwtMessages('address')
  const newBtcAddressReq = () => addressMsgs.build({ symbol: 'btc' })

  it('generate new address', async () => {
    const newAddressResponse = await wsClient.send(newBtcAddressReq())

    newAddressResponse.status.should.equal(OK_STATUS)
    newAddressResponse.action.should.equal('address')

    const addressInfo = await mexWallet.getAddressInfo(newAddressResponse.address)
    addressInfo.ismine.should.equal(true)
  })

  describe('client errors', () => {
    const expectNewAddressError = async (changeReq = _ => { }) => {
      const req = newBtcAddressReq()
      changeReq(req)
      const res = await wsClient.send(req)
      res.should.deep.equal({ status: ERROR_STATUS, message: req })
    }

    it('missing action parameter', () => expectNewAddressError(req => { delete req.action }))
    it('invalid action', () => expectNewAddressError(req => { req.action = 'addressX' }))
    it('missing action parameter', () => expectNewAddressError(req => { delete req.action }))
    it('empty symbol', () => expectNewAddressError(req => { req.symbol = '' }))
    it('unkown symbol', () => expectNewAddressError(req => { req.symbol = 'ukn' }))
    it('additional request parameters', () => expectNewAddressError(req => { req.additional = 'param' }))
  })
})
