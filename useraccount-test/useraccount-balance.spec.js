const {
  dbconnection: { ObjectId, collection }
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
        { symbol: 'btc', amount: '922337203685477587' }
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
