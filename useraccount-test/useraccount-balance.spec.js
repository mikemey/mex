const {
  dbconnection: { ObjectId, Long, collection },
  wsmessages: { withAction }
} = require('../utils')

const orchestrator = require('./useraccount.orch')
const { TestDataSetup: { seedTestData, dropTestDatabase } } = require('../test-tools')

describe('UserAccount balance', () => {
  let useragent, walletMock
  const balanceColl = () => collection('balances')

  before(async () => {
    await dropTestDatabase()
    await seedTestData();
    ({ useragent, walletMock } = await orchestrator.start({ authenticatedAgent: true }))
  })
  after(() => orchestrator.stop())

  describe('page', () => {
    it('user without balance-record', async () => {
      const res = await useragent.get('/balance')
      const html = orchestrator.withHtml(res).html
      html.pageTitle().should.equal('mex balances')
      html.$('[data-balance="btc"]').text().should.equal('0.00000000')
      html.$('[data-balance="eth"]').text().should.equal('0.00000000')

      const assertButtons = symbol => {
        html.$(`[data-deposit="${symbol}"]`).text().should.equal('Deposit')
        html.$(`[data-withdraw="${symbol}"]`).text().should.equal('Withdraw')
      }
      assertButtons('btc')
      assertButtons('eth')
    })

    it('existing user with balance', async () => {
      await balanceColl().insertOne({
        _id: ObjectId(orchestrator.testUserId),
        assets: [{ symbol: 'btc', amount: Long.fromString('9223372036854775807') }]
      })
      const res = await useragent.get('/balance')
      const html = orchestrator.withHtml(res).html
      html.pageTitle().should.equal('mex balances')
      html.$('[data-balance="btc"]').text().should.equal('92233720368.54775807')
      html.$('[data-balance="eth"]').text().should.equal('0.00000000')
    })
  })

  describe('deposit', async () => {
    const addressMessages = withAction('address')

    it('request address from wallet service', async () => {
      const addressReq = addressMessages.build({ symbol: 'btc' })
      const addressRes = addressMessages.ok({ address: 'abcdef' })

      walletMock.addMockFor(addressReq, addressRes)
      const res = await useragent.get('/balance/address/btc')
      res.status.should.equal(200)
      res.body.address.should.equal(addressRes.address)
      walletMock.assertReceived(addressReq)
    })
  })
})
