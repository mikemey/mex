const chai = require('chai')
chai.use(require('chai-string'))

const orchestrator = require('./useraccount.orch')
const defaultSettings = require('../useraccount/defaults.json')

describe('UserAccountService', () => {
  const agent = orchestrator.agent()

  describe('uses configuration', () => {
    before(() => orchestrator.start({ startMock: false }))
    after(() => orchestrator.stop())

    it('version', () => agent.get('/version')
      .then(res => res.text.should.startWith(defaultSettings.httpserver.version))
    )

    it('csrf is working', () => orchestrator.agent().post('/')
      .then(res => res.status.should.equal(403))
    )
  })

  xdescribe('user access', () => {
    before(() => orchestrator.start())
    after(() => orchestrator.stop())

    it('not authenticated redirects to login page', () => agent.get('/home').redirects(false)
      .then(res => {
        res.should.have.status(303)
        res.should.have.header('location', /.*login$/)
      })
    )
  })
})
