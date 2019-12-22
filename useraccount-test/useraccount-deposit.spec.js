const moment = require('moment')

const { wsmessages: { withAction, error } } = require('../utils')

const orchestrator = require('./useraccount.orch')
const { TestDataSetup: { seedTestData, dropTestDatabase } } = require('../test-tools')

describe('UserAccount Deposits', () => {
  let useragent, walletMock

  before(async () => {
    await dropTestDatabase()
    await seedTestData();
    ({ useragent, walletMock } = await orchestrator.start({ authenticatedAgent: true }))
  })
  after(() => orchestrator.stop())
  beforeEach(() => walletMock.reset())

  const addressBuilder = withAction('address')
  const invoicesBuilder = withAction('invoices')
  const getAddressReq = (symbol = 'eth') => orchestrator.withJwtMessages(addressBuilder.build({ symbol }))
  const getAddressResOk = address => addressBuilder.ok({ address })
  const errorRes = error('test')
  const getInvoicesReq = (symbol = 'eth') => orchestrator.withJwtMessages(invoicesBuilder.build({ symbol }))
  const getInvoicesResOk = invoices => addressBuilder.ok({ invoices })

  const depositPath = slug => `/balance/deposit${slug}`

  const daysPast = days => moment.utc().subtract(days, 'd')
  const createInvoice = (invoiceId, past, amount, blockheight) => {
    return {
      _id: { invoiceId },
      date: daysPast(past).toISOString(),
      amount,
      blockheight
    }
  }

  it('request address + deposit history from wallet service', async () => {
    const address = 'abccdef'
    const invoices = [
      createInvoice('inv-id-1', 3, '123', 120),
      createInvoice('inv-id-2', 2, '345', 133),
      createInvoice('inv-id-3', 0, '678000000', null),
      createInvoice('inv-id-4', 10, '93100000', 5)
    ]

    const createExpectInvoiceRow = ({ _id: { invoiceId }, date, blockheight }, hrAmount) => {
      const hrDate = moment.utc(date).format('LLLL')
      const hrBlock = (blockheight && String(blockheight)) || 'unconfirmed'
      return [hrDate, hrAmount, hrBlock, invoiceId]
    }
    const createExpectInvoiceLink = ({ _id: { invoiceId }, blockheight }) => {
      const block = blockheight
        ? `https://www.etherchain.org/block/${blockheight}`
        : 'unconfirmed'
      const tx = `https://www.etherchain.org/tx/${invoiceId}`
      return { block, tx }
    }

    const expectedInvoiceRows = [
      createExpectInvoiceRow(invoices[2], '678.000000'),
      createExpectInvoiceRow(invoices[1], '0.000345'),
      createExpectInvoiceRow(invoices[0], '0.000123'),
      createExpectInvoiceRow(invoices[3], '93.100000')
    ]

    const expectedInvoiceLinks = [
      createExpectInvoiceLink(invoices[2]),
      createExpectInvoiceLink(invoices[1]),
      createExpectInvoiceLink(invoices[0]),
      createExpectInvoiceLink(invoices[3])
    ]

    walletMock.addMockFor(getAddressReq(), getAddressResOk(address))
    walletMock.addMockFor(getInvoicesReq(), getInvoicesResOk(invoices))
    const res = orchestrator.withHtml(await useragent.get(depositPath('/eth')))
    res.status.should.equal(200)
    res.html.pageTitle().should.equal('mex eth deposits')

    const $ = res.html.$
    $('[data-address="eth"]').text().should.equal(address)

    const extractColsFromRow = trElmt => $(trElmt).children('td')
      .map((_, td) => $(td).text())
      .get()

    const uiInvoices = $('tbody tr')
      .map((_, el) => [extractColsFromRow(el)]) // <-- jquery's .map automatically flattens nested arrays, wtf?!
      .get()
    const uiLinks = $('tbody tr').map((_, tr) => {
      const extractHrefFromCol = num => $(tr).find(`td:nth-child(${num}) a`).attr('href')
      const block = extractHrefFromCol(3) || 'unconfirmed'
      const tx = extractHrefFromCol(4)
      return { block, tx }
    }).get()

    uiInvoices.should.deep.equal(expectedInvoiceRows)
    uiLinks.should.deep.equal(expectedInvoiceLinks)

    walletMock.assertReceived(getAddressReq(), getInvoicesReq())
  })

  it('block + invoice links open new tab', async () => {
    const invoices = [createInvoice('inv-id-1', 3, '123', 120)]
    walletMock.addMockFor(getAddressReq('btc'), getAddressResOk('an address'))
    walletMock.addMockFor(getInvoicesReq('btc'), getInvoicesResOk(invoices))

    const res = orchestrator.withHtml(await useragent.get(depositPath('/btc')))
    const allTargets = res.html.$('tr[data-invoice="inv-id-1"] a').map((_, anch) => anch.attribs.target).get()
    allTargets.should.deep.equal(['_blank', '_blank'])
  })

  it('request address request fails', async () => {
    walletMock.addMockFor(getAddressReq('btc'), errorRes)
    walletMock.addMockFor(getInvoicesReq('btc'), getInvoicesResOk([]))

    const res = orchestrator.withHtml(await useragent.get(depositPath('/btc')))
    res.status.should.equal(200)
    res.html.pageTitle().should.equal('mex balances')
    res.html.$('#message').text().should.equal('wallet service error')
  })

  it('request deposit history request fails', async () => {
    walletMock.addMockFor(getAddressReq('btc'), getAddressResOk('abc'))
    walletMock.addMockFor(getInvoicesReq('btc'), errorRes)

    const res = orchestrator.withHtml(await useragent.get(depositPath('/btc')))
    res.status.should.equal(200)
    res.html.pageTitle().should.equal('mex balances')
    res.html.$('#message').text().should.equal('wallet service error')
  })

  it('redirects to /balances for unknown symbol', async () => {
    const res = orchestrator.withHtml(await useragent.get(depositPath('/unknown')))
    res.status.should.equal(200)
    res.html.pageTitle().should.equal('mex balances')
    res.html.$('#message').text().should.equal('asset not supported: unknown')
  })
})
