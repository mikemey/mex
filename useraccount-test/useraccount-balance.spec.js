const {
  dbconnection: { ObjectId, Long, collection },
  wsmessages: { withAction, error }
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
      res.html.$('[data-balance="eth"]').text().should.equal('0.00000000')
    })

    it('existing user with balance', async () => {
      await balanceColl.insertOne({
        _id: ObjectId(orchestrator.testUserId),
        assets: [{ symbol: 'btc', amount: Long.fromString('9223372036854775807') }]
      })
      const res = orchestrator.withHtml(await useragent.get('/balance'))
      res.html.pageTitle().should.equal('mex balances')
      res.html.$('[data-balance="btc"]').text().should.equal('92233720368.54775807')
      res.html.$('[data-balance="eth"]').text().should.equal('0.00000000')
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

  describe('deposit', async () => {
    const actionBuilder = withAction('address')
    const getAddressReq = symbol => orchestrator.withJwtMessages(actionBuilder.build({ symbol }))
    const getAddressResOk = address => actionBuilder.ok({ address })
    const getAddressResError = error('test')

    const depositPath = slug => `/balance/deposit${slug}`

    it('request address from wallet service', async () => {
      const addressReq = getAddressReq('btc')
      const address = 'abccdef'
      walletMock.addMockFor(getAddressReq('btc'), getAddressResOk(address))
      const res = orchestrator.withHtml(await useragent.get(depositPath('/btc')))
      res.status.should.equal(200)
      res.html.pageTitle().should.equal('mex btc deposits')
      res.html.$('[data-address="btc"]').text().should.equal(address)

      walletMock.assertReceived(addressReq)
    })

    it('request address fails', async () => {
      walletMock.addMockFor(getAddressReq('btc'), getAddressResError)
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

    xit('show existing deposits', () => {
      // throw new Error('implement me')
    })
  })
})
