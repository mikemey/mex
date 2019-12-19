const moment = require('moment')

const {
  dbconnection: { ObjectId, collection },
  wsmessages: { withAction, error },
  units: { Satoshi }
} = require('../utils')

const orchestrator = require('./useraccount.orch')
const { TestDataSetup: { seedTestData, dropTestDatabase } } = require('../test-tools')

describe('UserAccount balance', () => {
  let useragent, walletMock
  const balanceColl = collection('balances')

  before(async () => {
    await dropTestDatabase()
    await seedTestData();
    ({ useragent, walletMock } = await orchestrator.start({ authenticatedAgent: true }))
  })
  after(() => orchestrator.stop())
  beforeEach(() => walletMock.reset())

  describe('balance overview page', () => {
    it('user without balance-record', async () => {
      const res = orchestrator.withHtml(await useragent.get('/balance'))
      res.html.pageTitle().should.equal('mex balances')
      res.html.$('[data-balance="btc"]').text().should.equal('0.00000000')
      res.html.$('[data-balance="eth"]').text().should.equal('0.000000')
    })

    it('existing user with balance', async () => {
      await balanceColl.insertOne({
        _id: ObjectId(orchestrator.testUserId),
        assets: [
          { symbol: 'btc', amount: Satoshi.fromString('922337203685477587') }
        ]
      })
      const res = orchestrator.withHtml(await useragent.get('/balance'))
      res.html.pageTitle().should.equal('mex balances')
      res.html.$('[data-balance="btc"]').text().should.equal('9223372036.85477587')
      res.html.$('[data-balance="eth"]').text().should.equal('0.000000')
    })

    it('deposit/withdraw links', async () => {
      const res = orchestrator.withHtml(await useragent.get('/balance'))
      const assertActionLinks = (symbol, linkText, linkHref) => {
        const link = res.html.$(`[data-${linkText.toLowerCase()}="${symbol}"]`)
        link.text().should.equal(linkText)
        link.attr('href').should.equal(linkHref)
      }

      const depositText = 'Deposit'
      const withdrawText = 'Withdraw'
      const depositHref = slug => `balance/deposit${slug}`
      const withdrawHref = slug => `balance/withdraw${slug}`

      assertActionLinks('btc', depositText, depositHref('/btc'))
      assertActionLinks('btc', withdrawText, withdrawHref('/btc'))
      assertActionLinks('eth', depositText, depositHref('/eth'))
      assertActionLinks('eth', withdrawText, withdrawHref('/eth'))
    })
  })

  describe('deposits', async () => {
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
        createInvoice('inv-id-1', 1, '123', 2),
        createInvoice('inv-id-2', 2, '345', 3),
        createInvoice('inv-id-3', 3, '678000000', 4),
        createInvoice('inv-id-4', 10, '93100000', 5)
      ]
      const hrInvoiceAmounts = ['0.000123', '0.000345', '678.000000', '93.100000']

      const createExpectInvoiceRow = ({ _id: { invoiceId }, date, amount, blockheight }, ix) => {
        const hrDate = moment(date).format('LLLL')
        const hrAmount = hrInvoiceAmounts[ix]
        const hrBlock = String(blockheight)
        return [hrDate, hrAmount, hrBlock, invoiceId]
      }
      const createExpectInvoiceLink = ({ _id: { invoiceId }, blockheight }) => {
        return {
          block: `https://www.etherchain.org/block/${blockheight}`,
          tx: `https://www.etherchain.org/tx/${invoiceId}`
        }
      }
      const expectedInvoiceRows = invoices.map(createExpectInvoiceRow)
      const expectedInvoiceLinks = invoices.map(createExpectInvoiceLink)

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
        const block = extractHrefFromCol(3)
        const tx = extractHrefFromCol(4)
        return { block, tx }
      }).get()

      uiInvoices.should.deep.equal(expectedInvoiceRows)
      uiLinks.should.deep.equal(expectedInvoiceLinks)

      walletMock.assertReceived(getAddressReq(), getInvoicesReq())
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
})
