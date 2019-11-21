const orchestrator = require('./orchestrator')

describe('UserAccount register', () => {
  before(() => orchestrator.start())
  after(() => orchestrator.stop())

  describe('registration page', () => {
    const checkField = (el, expType, expPlaceholder) => {
      el.attr('type').should.equal(expType)
      el.attr('placeholder').should.equal(expPlaceholder)
    }

    it('has all required fields', () => orchestrator.agent().get('/register')
      .then(res => {
        // res.should.have.header('x-csrf-token')
        return orchestrator.asHtml(res)
      })
      .then(html => {
        checkField(html('#email'), 'email', 'Email')
        checkField(html('#password'), 'password', 'Password')
        checkField(html('#password-confirm'), 'password', 'Confirmation')
      })
    )
  })
})
