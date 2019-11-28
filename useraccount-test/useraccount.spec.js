const chai = require('chai')
chai.use(require('chai-string'))

const orchestrator = require('./uaorchestrator')
const defaultSettings = require('../useraccount/defaults.json')

describe('UserAccountService', () => {
  describe('uses configuration', () => {
    before(() => orchestrator.start({ startMock: false }))
    after(() => orchestrator.stop())

    it('version', () => orchestrator.agent().get('/version')
      .then(res => res.text.should.startWith(defaultSettings.httpserver.version))
    )

    it('csrf is working', () => orchestrator.agent().post('/')
      .then(res => res.status.should.equal(403))
    )
  })
})
