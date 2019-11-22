const orchestrator = require('../orchestrator')

describe.only('UserAccount register', () => {
  const agent = orchestrator.agent()
  before(() => orchestrator.start())
  after(() => orchestrator.stop())

  describe('registration page', () => {
    const checkField = (el, expType, expPlaceholder) => {
      el.attr('type').should.equal(expType)
      el.attr('name').should.equal(expPlaceholder.toLowerCase())
      el.attr('placeholder').should.equal(expPlaceholder)
    }

    it('has all required fields', () => agent.get('/register')
      .then(res => orchestrator.asHtml(res))
      .then(html => {
        checkField(html('#email'), 'email', 'Email')
        checkField(html('#password'), 'password', 'Password')
        checkField(html('#confirmation'), 'password', 'Confirmation')
      })
    )
  })
})
