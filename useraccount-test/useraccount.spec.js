const chai = require('chai')
chai.use(require('chai-string'))

const orchestrator = require('./uaorchestrator')
const defaultSettings = require('../useraccount/defaults.json')

describe('UserAccountService', () => {
  describe('uses configuration', () => {
    const agent = orchestrator.agent()

    before(() => orchestrator.start({ startMock: false }))
    after(() => orchestrator.stop())

    it('version', () => agent.get('/version')
      .then(res => res.text.should.startWith(defaultSettings.httpserver.version))
    )
  })
})
