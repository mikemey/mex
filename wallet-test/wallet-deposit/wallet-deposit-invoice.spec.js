const { TestDataSetup: { dropTestDatabase, registeredUser } } = require('../../test-tools')
const {
  messages: { OK_STATUS, ERROR_STATUS },
  dbconnection: { ObjectId, collection }
} = require('../../utils')

const {
  startServices, stopServices, wsClient, withJwtMessages, sessionMock,
  setSessionMockUser
} = require('../wallet.orch')

describe('Wallet depositer - invoice', () => {
  const invoicesColl = collection('invoices')

  const invoicesMsgs = withJwtMessages('invoices')
  const getInvoiceReq = (symbol = 'btc') => invoicesMsgs.build({ symbol })

  before(startServices)
  after(stopServices)

  beforeEach(dropTestDatabase)

  it('no invoices for new user', async () => {
    const testUserId = '5def654c9ad3f153493e3bbb'
    sessionMock.reset()
    setSessionMockUser({ id: testUserId })
    const invoicesResponse = await wsClient.send(getInvoiceReq())

    invoicesResponse.status.should.equal(OK_STATUS)
    invoicesResponse.action.should.equal('invoices')
    invoicesResponse.invoices.should.deep.equal([])
  })

  it('invoices for existing user', async () => {
    const secondUserId = '59a70a4293b8187fe4d25043'
    const thirdUserId = '59a708d8eecd787e582bdda3'
    const dbInvoice = (invoiceId, { rawId = registeredUser.id, symbol = 'eth' } = {}) => {
      return {
        _id: { userId: ObjectId(rawId), symbol, invoiceId },
        date: '2019-12-19T13:59:55.163Z',
        amount: '12345000',
        blockheight: 1965
      }
    }
    const toExpectedInvoice = ({ _id: { userId, symbol, invoiceId }, date, amount, blockheight }) => {
      return { userId: userId.toString(), symbol, invoiceId, date, amount, blockheight }
    }

    await invoicesColl.insertMany([
      dbInvoice(1),
      dbInvoice(2, { rawId: secondUserId }),
      dbInvoice(3, { symbol: 'other' }),
      dbInvoice(4)
    ])

    const expectInvoices = async (userId, ...invoices) => {
      sessionMock.reset()
      setSessionMockUser({ id: userId })

      const flatInvoices = invoices.map(toExpectedInvoice)

      const invoicesResponse = await wsClient.send(getInvoiceReq('eth'))
      invoicesResponse.should.deep.equal(
        { status: OK_STATUS, action: 'invoices', invoices: flatInvoices }
      )
    }

    await expectInvoices(registeredUser.id, dbInvoice(1), dbInvoice(4))
    await expectInvoices(secondUserId, dbInvoice(2, { rawId: secondUserId }))
    await expectInvoices(thirdUserId)
  })

  it('returns error for unknown asset', async () => {
    const invcResponse = await wsClient.send(getInvoiceReq('unknown'))
    invcResponse.status.should.equal(ERROR_STATUS)
    invcResponse.should.not.have.property('invoices')
  })
})
