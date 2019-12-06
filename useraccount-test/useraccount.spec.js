const chai = require('chai')
chai.use(require('chai-string'))

const orchestrator = require('./useraccount.orch')
const defaultSettings = require('../useraccount/defaults.json')

describe('UserAccountService', () => {
  let useragent

  describe('uses configuration', () => {
    before(async () => ({ useragent } = await orchestrator.start({ startSessionMock: false })))
    after(() => orchestrator.stop())

    it('version', () => useragent.get('/version')
      .then(res => res.text.should.startWith(defaultSettings.httpserver.version))
    )

    it('csrf is working', async () => {
      const agent = await orchestrator.createAgent({ crsf: false })
      const res = await agent.post('/')
      res.status.should.equal(403)
    })
  })

  describe('user access', () => {
    before(async () => ({ useragent } = await orchestrator.start()))
    after(() => orchestrator.stop())

    it('not authenticated redirects to login page', () => useragent.get('/index').redirects(false)
      .then(res => {
        res.should.have.status(303)
        const redirectLocation = res.header.location
        redirectLocation.should.match(/.*login\?flag=auth$/)
        return useragent.get(redirectLocation)
      })
      .then(orchestrator.withHtml)
      .then(res => {
        res.html.pageTitle().should.equal('mex login')
        res.html.$('#message').text().should.equal('Please log-in')
      })
    )

    const publicEndpoints = ['/version', '/login', '/register']
    publicEndpoints.forEach(freePath => {
      it(`${freePath} is available without authorization`, () => useragent.get(freePath).redirects(false)
        .then(res => {
          res.should.have.status(200)
          res.should.have.cookie('x-session')
        })
      )
    })
  })
})
