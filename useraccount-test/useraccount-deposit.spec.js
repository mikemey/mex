const moment = require('moment')

const { messages: { withAction, error } } = require('../utils')

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
  const getAddressReq = symbol => orchestrator.withJwtMessages(addressBuilder.build({ symbol }))
  const getAddressResOk = address => addressBuilder.ok({ address })
  const errorRes = error('test')
  const getInvoicesReq = symbol => orchestrator.withJwtMessages(invoicesBuilder.build({ symbol }))
  const getInvoicesResOk = invoices => addressBuilder.ok({ invoices })

  const depositPath = symbol => `/balance/deposit/${symbol}`

  const daysPast = days => moment.utc().subtract(days, 'd')
  const createInvoice = (invoiceId, past, symbol, amount, blockheight) => {
    return {
      userId: 123,
      symbol,
      invoiceId,
      date: daysPast(past).toISOString(),
      amount,
      blockheight
    }
  }

  it('request address + deposit history from wallet service', async () => {
    const address = 'abccdef'
    const testSymbol = 'eth'
    const invoices = [
      createInvoice('inv-id-1', 3, testSymbol, '1000', 120),
      createInvoice('inv-id-2', 2, testSymbol, '345000', 133),
      createInvoice('inv-id-3', 1, testSymbol, '6780000000', null),
      createInvoice('inv-id-4', 10, testSymbol, '93100000', 5),
      createInvoice('inv-id-5', 0, testSymbol, '780000000', null)
    ]

    const createExpectInvoiceRow = ({ invoiceId, date, blockheight }, hrAmount) => {
      const hrDate = moment.utc(date).format('LLLL')
      const hrBlock = (blockheight && String(blockheight)) || 'unconfirmed'
      return [hrDate, hrAmount, hrBlock, invoiceId]
    }
    const createExpectInvoiceLink = ({ invoiceId, blockheight }) => {
      const block = blockheight
        ? `https://www.etherchain.org/block/${blockheight}`
        : 'unconfirmed'
      const tx = `https://www.etherchain.org/tx/${invoiceId}`
      return { block, tx }
    }

    const expectedInvoiceRows = [
      createExpectInvoiceRow(invoices[4], '0.780000'),
      createExpectInvoiceRow(invoices[2], '6.780000'),
      createExpectInvoiceRow(invoices[1], '0.000345'),
      createExpectInvoiceRow(invoices[0], '0.000001'),
      createExpectInvoiceRow(invoices[3], '0.093100')
    ]

    const expectedInvoiceLinks = [
      createExpectInvoiceLink(invoices[4]),
      createExpectInvoiceLink(invoices[2]),
      createExpectInvoiceLink(invoices[1]),
      createExpectInvoiceLink(invoices[0]),
      createExpectInvoiceLink(invoices[3])
    ]

    walletMock.addMockFor(getAddressReq(testSymbol), getAddressResOk(address))
    walletMock.addMockFor(getInvoicesReq(testSymbol), getInvoicesResOk(invoices))
    const res = orchestrator.withHtml(await useragent.get(depositPath(testSymbol)))
    res.status.should.equal(200)
    res.html.pageTitle().should.equal('mex eth deposits')

    const $ = res.html.$
    $(`[data-address="${testSymbol}"]`).text().should.equal(address)

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

    walletMock.assertReceived(getAddressReq(testSymbol), getInvoicesReq(testSymbol))
  })

  it('block + invoice links open new tab', async () => {
    const testSymbol = 'btc'
    const invoices = [createInvoice('inv-id-1', 3, testSymbol, '123', 120)]
    walletMock.addMockFor(getAddressReq(testSymbol), getAddressResOk('an address'))
    walletMock.addMockFor(getInvoicesReq(testSymbol), getInvoicesResOk(invoices))

    const res = orchestrator.withHtml(await useragent.get(depositPath(testSymbol)))
    const allTargets = res.html.$('tr[data-invoice="inv-id-1"] a').map((_, anch) => anch.attribs.target).get()
    allTargets.should.deep.equal(['_blank', '_blank'])
  })

  it('address request fails', async () => {
    walletMock.addMockFor(getAddressReq('btc'), errorRes)
    walletMock.addMockFor(getInvoicesReq('btc'), getInvoicesResOk([]))

    const res = orchestrator.withHtml(await useragent.get(depositPath('btc')))
    res.status.should.equal(200)
    res.html.pageTitle().should.equal('mex balances')
    res.html.$('#message').text().should.equal('wallet service error')
  })

  it('request deposit history request fails', async () => {
    walletMock.addMockFor(getAddressReq('btc'), getAddressResOk('abc'))
    walletMock.addMockFor(getInvoicesReq('btc'), errorRes)

    const res = orchestrator.withHtml(await useragent.get(depositPath('btc')))
    res.status.should.equal(200)
    res.html.pageTitle().should.equal('mex balances')
    res.html.$('#message').text().should.equal('wallet service error')
  })

  it('redirects to /balances for unknown symbol', async () => {
    const res = orchestrator.withHtml(await useragent.get(depositPath('unknown')))
    res.status.should.equal(200)
    res.html.pageTitle().should.equal('mex balances')
    res.html.$('#message').text().should.equal('asset not supported: unknown')
  })
})
