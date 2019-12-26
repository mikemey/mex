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
    await dropTestDatabase()
    await seedTestData();
    ({ useragent, walletMock, sessionMock } = await orchestrator.start({ authenticatedAgent: true }))
  })
  after(() => orchestrator.stop())
  beforeEach(() => walletMock.reset())

  const getBalancePage = async () => orchestrator.withHtml(await useragent.get('/balance'))

  const assertBalance = (symbol, balance, res) => res.html.$(`[data-balance="${symbol}"]`).text().should.equal(balance)

  it('user without balance-record', async () => {
    const res = await getBalancePage()
    res.html.pageTitle().should.equal('mex balances')
    assertBalance('btc', '0.00000000', res)
    assertBalance('eth', '0.000000', res)
  })

  it('existing user with balance', async () => {
    await balanceColl.insertOne({
      _id: ObjectId(orchestrator.testUserId),
      assets: [
        { symbol: 'btc', amount: '922337203685477587' }
      ]
    })
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

  xit('update balance with 1 confirmation required', async () => {
    const symbol = 'btc'
    const userId = '123456789abcdeabcde01234'
    const verifyMessages = withAction('verify')
    const verifyRequest = orchestrator.withJwtMessages(verifyMessages.build())
    const verifyResponse = verifyMessages.ok({ user: { id: userId } })
    sessionMock.reset()
    sessionMock.addMockFor(verifyRequest, verifyResponse)

    const unconfirmedMessage = {
      blockheight: 381,
      invoices: [
        { userId, symbol, invoiceId: '123', date: '2019-12-26T08:48:21.615Z', amount: '84375244', blockheight: null }
      ]
    }
    const confirmedMessage = {
      blockheight: 382,
      invoices: [
        { userId, symbol, invoiceId: '123', date: '2019-12-26T09:27:43.106Z', amount: '84375244', blockheight: 382 },
        { userId: orchestrator.testUserId, symbol, invoiceId: '124', date: '2019-12-26T09:27:43.106Z', amount: '111111111', blockheight: 382 }
      ]
    }

    await walletMock.broadcast('invoices', unconfirmedMessage)
    assertBalance(symbol, '0.00000000', await getBalancePage())

    await walletMock.broadcast('invoices', confirmedMessage)
    assertBalance(symbol, '0.84375244', await getBalancePage())
  })

  // it('update balance with > 1 confirmations required', async () => {
  //   walletMock.logger.setLogLevel(LOG_LEVELS.debug)
  //   assertBalance('eth', '0.000000', await getBalancePage())

  //   assertBalance('eth', '3.330000', await getBalancePage())
  // })
})
