const { promisify } = require('util')

const timeoutPromise = promisify(setTimeout)

const {
  dbconnection: { ObjectId, collection },
  wsmessages: { withAction }
} = require('../utils')

const orchestrator = require('./useraccount.orch')
const { TestDataSetup: { seedTestData, dropTestDatabase } } = require('../test-tools')

describe('UserAccount balance', () => {
  let useragent, walletMock, sessionMock
  const balanceColl = collection('balances')

  before(async () => {
    ({ useragent, walletMock, sessionMock } = await orchestrator.start({ authenticatedAgent: true }))
  })
  after(() => orchestrator.stop())

  beforeEach(async () => {
    await dropTestDatabase()
    await seedTestData()
  })
  beforeEach(() => walletMock.reset())

  const getBalancePage = async () => orchestrator.withHtml(await useragent.get('/balance'))
  const assertBalance = (symbol, balance, res) => res.html.$(`[data-balance="${symbol}"]`).text().should.equal(balance)

  const insertTestUserBalance = btcAmount => balanceColl.insertMany([
    { _id: { userId: ObjectId(orchestrator.testUserId), symbol: 'btc' }, amount: btcAmount },
    { _id: { userId: ObjectId(orchestrator.testUserId), symbol: 'not-supported' }, amount: '123' }
  ])

  it('user without balance-record', async () => {
    const res = await getBalancePage()
    res.html.pageTitle().should.equal('mex balances')
    assertBalance('btc', '0.00000000', res)
    assertBalance('eth', '0.000000', res)
  })

  it('existing user with balance', async () => {
    await insertTestUserBalance('922337203685477587')

    const res = await getBalancePage()
    res.html.pageTitle().should.equal('mex balances')
    assertBalance('btc', '9223372036.85477587', res)
    assertBalance('eth', '0.000000', res)
  })

  it('deposit/withdraw links', async () => {
    const res = await getBalancePage()
    const assertActionLinks = (symbol, linkText, linkHref) => {
      const link = res.html.$(`[data-${linkText.toLowerCase()}="${symbol}"]`)
      link.text().should.equal(linkText)
      link.attr('href').should.equal(linkHref)
    }

    const depositText = 'Deposit'
    const withdrawText = 'Withdraw'
    const depositHref = symbol => `balance/deposit/${symbol}`
    const withdrawHref = symbol => `balance/withdraw/${symbol}`

    assertActionLinks('btc', depositText, depositHref('btc'))
    assertActionLinks('btc', withdrawText, withdrawHref('btc'))
    assertActionLinks('eth', depositText, depositHref('eth'))
    assertActionLinks('eth', withdrawText, withdrawHref('eth'))
  })

  const waitForBalanceRecord = async (rawUserId, symbol, amount, retry = 5) => {
    if (retry <= 0) { throw Error(`retries exceeded waiting for: ${rawUserId} - ${symbol} - ${amount}`) }
    const balance = await balanceColl.findOne({ _id: { userId: ObjectId(rawUserId), symbol }, amount })
    if (!balance) {
      await timeoutPromise(5)
      return waitForBalanceRecord(rawUserId, symbol, amount, --retry)
    }
    return balance
  }

  it('update btc balance with 1 confirmation required', async () => {
    await insertTestUserBalance('100000000')
    const symbol = 'btc'
    const newUserId = 'abcdeabcdabcdeabcdeabcde'
    const verifyMessages = withAction('verify')
    const verifyRequest = orchestrator.withJwtMessages(verifyMessages.build())
    const verifyResponse = verifyMessages.ok({ user: { id: newUserId } })
    sessionMock.reset()
    sessionMock.addMockFor(verifyRequest, verifyResponse)

    const unconfirmedMessage = {
      blockheight: 381,
      invoices: [
        { userId: newUserId, symbol, invoiceId: '123', date: 'irrelevant', amount: '77777777', blockheight: null }
      ]
    }
    const confirmedMessage = {
      blockheight: 382,
      invoices: [
        { userId: newUserId, symbol, invoiceId: '123', date: 'irrelevant', amount: '77777777', blockheight: 382 },
        { userId: orchestrator.testUserId, symbol, invoiceId: '124', date: 'irrelevant', amount: '111111111', blockheight: 382 },
        { userId: newUserId, symbol, invoiceId: '125', date: 'irrelevant', amount: '22222222', blockheight: 382 },
        { userId: orchestrator.testUserId, symbol, invoiceId: '126', date: 'irrelevant', amount: '33333333', blockheight: 382 }
      ]
    }

    await walletMock.broadcast('invoices', unconfirmedMessage)
    await timeoutPromise(20)
    assertBalance(symbol, '0.00000000', await getBalancePage())

    await walletMock.broadcast('invoices', confirmedMessage)
    await waitForBalanceRecord(orchestrator.testUserId, symbol, '244444444')

    const newUserBtc = await balanceColl.findOne({ '_id.userId': ObjectId(newUserId), '_id.symbol': symbol })
    newUserBtc.amount.should.equal('99999999')
    assertBalance(symbol, '0.99999999', await getBalancePage())
  })

  it('update eth balance with 12 confirmations required', async () => {
    const symbol = 'eth'
    const otherUserId = 'abcdeabcdabcdeabcdeabcde'
    const confirmedMessage = {
      blockheight: 401,
      invoices: [
        { userId: orchestrator.testUserId, symbol, invoiceId: '200', date: 'irrelevant', amount: '1111111111', blockheight: 401 },
        { userId: orchestrator.testUserId, symbol, invoiceId: '201', date: 'irrelevant', amount: '55555555555', blockheight: 401 },
        { userId: otherUserId, symbol, invoiceId: '202', date: 'irrelevant', amount: '77777777', blockheight: 401 }
      ]
    }
    const unconfirmedMessage = {
      blockheight: 402,
      invoices: [
        { userId: orchestrator.testUserId, symbol, invoiceId: '203', date: 'irrelevant', amount: '999999999999', blockheight: 402 }
      ]
    }
    const newBlockMessage = blockheight => { return { symbol, blockheight } }

    await walletMock.broadcast('invoices', confirmedMessage)
    await walletMock.broadcast('invoices', unconfirmedMessage)
    await timeoutPromise(10)
    assertBalance(symbol, '0.000000', await getBalancePage())

    for (let block = 402; block <= 411; block++) {
      await walletMock.broadcast('blocks', newBlockMessage(block))
    }
    await timeoutPromise(10)
    assertBalance(symbol, '0.000000', await getBalancePage())

    await walletMock.broadcast('blocks', newBlockMessage(412))
    await timeoutPromise(10)
    assertBalance(symbol, '56.666666', await getBalancePage())

    const unconfirmedInvoices = await collection('unsettled').find({}).toArray()
    unconfirmedInvoices.length.should.equal(1)
    unconfirmedInvoices[0].amount.should.equal('999999999999')
  })
})
