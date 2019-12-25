const chai = require('chai')
chai.use(require('chai-string'))

const orchestrator = require('./useraccount.orch')
const UserAccountService = require('../useraccount')

const { wsmessages: { withAction } } = require('../utils')

describe('UserAccountService', () => {
  let useragent

  describe('uses configuration', () => {
    before(async () => ({ useragent } = await orchestrator.start(
      { startSessionMock: false, startWalletMock: false }
    )))
    after(() => orchestrator.stop())

    it('version', () => useragent.get('/version')
      .then(res => res.text.should.startWith(orchestrator.httpserverConfig.version))
    )

    it('csrf is working', async () => {
      const agent = await orchestrator.createAgent({ crsf: false })
      const res = await agent.post('/')
      res.status.should.equal(403)
    })
  })

  describe('backend services going down', () => {
    let walletMock, sessionMock

    before(async () => ({ useragent, sessionMock, walletMock } =
      await orchestrator.start({ authenticatedAgent: true })))
    after(() => orchestrator.stop())

    it('unavailable page shows default message', async () => {
      const unavailableRes = orchestrator.withHtml(await useragent.get('/unavailable'))
      unavailableRes.should.have.status(200)
      unavailableRes.html.pageTitle().should.equal('mex unavailable')
      unavailableRes.html.$('#message').text().should.equal('service unavailable, sorry!')
    })

    it('session-service down', async () => {
      await sessionMock.stop()
      const unavailableRes = orchestrator.withHtml(await useragent.get('/index'))
      unavailableRes.should.have.status(200)
      unavailableRes.html.pageTitle().should.equal('mex unavailable')
      unavailableRes.html.$('#message').text().should.equal('session service unavailable, sorry!')

      await sessionMock.start()
      const indexRes = orchestrator.withHtml(await useragent.get('/balance'))
      indexRes.html.pageTitle().should.equal('mex balances')
    })

    it('wallet-service down', async () => {
      await walletMock.stop()
      const unavailableRes = orchestrator.withHtml(await useragent.get('/balance/deposit/btc'))
      unavailableRes.should.have.status(200)
      unavailableRes.html.pageTitle().should.equal('mex unavailable')
      unavailableRes.html.$('#message').text().should.equal('wallet service unavailable, sorry!')

      const actionBuilder = withAction('address')
      const getAddressReq = orchestrator.withJwtMessages(actionBuilder.build({ symbol: 'btc' }))
      const getAddressResOk = actionBuilder.ok({ address: '1234' })
      const invoiceBuilder = withAction('invoices')
      const getInvoiceReq = orchestrator.withJwtMessages(invoiceBuilder.build({ symbol: 'btc' }))
      const getInvoiceResOk = invoiceBuilder.ok({ invoices: [] })

      walletMock.addMockFor(getAddressReq, getAddressResOk)
      walletMock.addMockFor(getInvoiceReq, getInvoiceResOk)
      await walletMock.start()
      const depositRes = orchestrator.withHtml(await useragent.get('/balance/deposit/btc'))
      depositRes.html.pageTitle().should.equal('mex btc deposits')
    })
  })

  describe('user access', () => {
    before(async () => ({ useragent } = await orchestrator.start()))
    after(() => orchestrator.stop())

    it('not authenticated redirects to login page', () => useragent.get('/index').redirects(false)
      .then(res => {
        res.should.have.status(303)
        const redirectLocation = res.header.location
        redirectLocation.should.match(/.*\/login\?flag=auth$/)
        return useragent.get(redirectLocation)
      })
      .then(orchestrator.withHtml)
      .then(res => {
        res.html.pageTitle().should.equal('mex login')
        res.html.$('#message').text().should.equal('Please log-in')
      })
    )

    const publicEndpoints = ['/version', '/login', '/register', '/unavailable']
    publicEndpoints.forEach(freePath => {
      it(`${freePath} is available without authorization`, () => useragent.get(freePath).redirects(false)
        .then(res => {
          res.should.have.status(200)
          res.should.have.cookie('x-session')
        })
      )
    })
  })

  describe('configuration check', () => {
    const testParameters = [
      { title: 'missing httpserver configuration', changeConfig: cfg => delete cfg.httpserver, error: '"httpserver" is required' },
      { title: 'missing sessionService configuration', changeConfig: cfg => delete cfg.sessionService, error: '"sessionService" is required' },
      { title: 'missing walletService configuration', changeConfig: cfg => delete cfg.walletService, error: '"walletService" is required' },
      { title: 'missing db configuration', changeConfig: cfg => delete cfg.db, error: '"db" is required' },
      { title: 'missing clientTimeout configuration', changeConfig: cfg => delete cfg.clientTimeout, error: '"clientTimeout" is required' }
    ]

    testParameters.forEach(params => {
      it(params.title, () => {
        const config = {
          httpserver: { does: 'not-matter' },
          sessionService: { does: 'not-matter' },
          walletService: { does: 'not-matter' },
          db: { does: 'not-matter' },
          clientTimeout: 10
        }
        params.changeConfig(config)
        assertConfigError(config, params.error)
      })
    })

    const assertConfigError = (errconfig, expectedMessage) =>
      (() => new UserAccountService(errconfig)).should.throw(Error, expectedMessage)
  })
})
