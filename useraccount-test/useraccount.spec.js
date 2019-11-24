const chai = require('chai')
chai.use(require('chai-string'))

const orchestrator = require('./orchestrator')
// const UserAccountService = require('../useraccount')
const { httpauth } = require('../useraccount/defaults.json')

describe('UserAccountService', () => {
  describe('common', () => {
    const agent = orchestrator.agent()
    before(() => orchestrator.start())
    after(() => orchestrator.stop())

    it('responds with configured version', () => agent.get('/version')
      .then(res => res.text.should.startWith(httpauth.version))
    )
  })

  describe('connection to SessionService', () => {
    it('uses configured authorization key', () => {
      // is configuration really passed on
    })
  })
})
