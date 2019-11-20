const chai = require('chai')
chai.use(require('chai-string'))

const orchestrator = require('./orchestrator')
const uas = require('../useraccount/settings.json')

describe('UserAccountService', () => {
  before(() => orchestrator.start())
  after(() => orchestrator.stop())

  it.only('responds with version', () => orchestrator.agent().get('/version')
    .then(res => {
      res.text.should.startWith(uas.version)
    })
  )
})
