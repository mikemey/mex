const orchestrator = require('../orchestrator')

describe('UserAccount register', () => {
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

    it('post forwards to login page', () => agent.get('/register')
      .then(() => agent.post('/register').redirects(false)
        .send('email=first@email.com')
        .send('password=supersecret')
        .send('confirmation=supersecret')
      ).then(res => {
        res.should.have.status(303)
        res.should.have.header('location', /.*login$/)
      })
    )
  })
})
