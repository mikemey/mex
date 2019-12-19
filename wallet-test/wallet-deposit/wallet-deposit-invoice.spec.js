const { TestDataSetup: { dropTestDatabase, registeredUser } } = require('../../test-tools')
const {
  wsmessages: { OK_STATUS, ERROR_STATUS },
  dbconnection: { collection }
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
    const secondUserId = 'second'
    const thirdUserId = 'third'
    const invoice = (invoiceId, { userId = registeredUser.id, symbol = 'eth' } = {}) => {
      return {
        _id: { userId, symbol, invoiceId },
        date: '2019-12-19T13:59:55.163Z',
        amount: '12345000',
        blockheight: 1965
      }
    }

    const dbInvoices = [
      invoice(1),
      invoice(2, { userId: secondUserId }),
      invoice(3, { symbol: 'other' }),
      invoice(4)
    ]
    await invoicesColl.insertMany(dbInvoices)

    const expectInvoices = async (userId, ...invoices) => {
      sessionMock.reset()
      setSessionMockUser({ id: userId })

      const invoicesResponse = await wsClient.send(getInvoiceReq('eth'))
      invoicesResponse.should.deep.equal(
        { status: OK_STATUS, action: 'invoices', invoices }
      )
    }

    await expectInvoices(registeredUser.id, invoice(1), invoice(4))
    await expectInvoices(secondUserId, invoice(2, { userId: secondUserId }))
    await expectInvoices(thirdUserId)
  })

  it('returns error for unknown asset', async () => {
    const invcResponse = await wsClient.send(getInvoiceReq('unknown'))
    invcResponse.status.should.equal(ERROR_STATUS)
    invcResponse.should.not.have.property('invoices')
  })
})
