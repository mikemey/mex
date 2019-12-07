const { dbconnection: { ObjectId, Long, collection } } = require('../utils')

const orchestrator = require('./useraccount.orch')
const { TestDataSetup: { seedTestData, dropTestDatabase } } = require('../test-tools')

describe('UserAccount balance', () => {
  let useragent
  const balanceColl = () => collection('balances')

  before(async () => {
    await dropTestDatabase()
    await seedTestData();
    ({ useragent } = await orchestrator.start({ authenticatedAgent: true }))
  })
  after(() => orchestrator.stop())

  it('user without balance-record', async () => {
    const res = await useragent.get('/balance')
    const html = orchestrator.withHtml(res).html
    html.pageTitle().should.equal('mex balances')
    html.$('[data-balance="btc"]').text().should.equal('0.00000000')
    html.$('[data-balance="eth"]').text().should.equal('0.00000000')
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
