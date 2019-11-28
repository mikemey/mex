const orchestrator = require('../uaorchestrator')
const { wsmessages } = require('../../utils')

describe('UserAccount register', () => {
  const agent = orchestrator.agent()
  const sessionMock = orchestrator.sessionMock
  const registerAction = wsmessages.withAction('register')

  before(() => orchestrator.start().then(() => agent.get('/version')))
  after(() => orchestrator.stop())
  beforeEach(() => sessionMock.reset())
  afterEach(() => sessionMock.errorCheck())

  const postRegistration = (email, password, confirmation) => agent.post('/register')
    .send(`email=${email}`).send(`password=${password}`).send(`confirmation=${confirmation}`)

  describe('registration page', () => {
    const checkField = (el, expType, expPlaceholder) => {
      el.attr('type').should.equal(expType)
      el.attr('name').should.equal(expPlaceholder.toLowerCase())
      el.attr('placeholder').should.equal(expPlaceholder)
    }

    it('has all required fields', () => agent.get('/register')
      .then(orchestrator.withHtml)
      .then(res => {
        checkField(res.html.$('#email'), 'email', 'Email')
        checkField(res.html.$('#password'), 'password', 'Password')
        checkField(res.html.$('#confirmation'), 'password', 'Confirmation')
      })
    )
  })

  describe('registration post', () => {
    const testEmail = 'hello@bla.com'
    const testPassword = 'mysecret'
    const backendRequest = (email = testEmail, password = testPassword) => {
      return { email, password, action: 'register' }
    }

    const backendOk = registerAction.ok()
    // const backendNok = message => registerAction.nok(message)
    // const backendError = wsmessages.error()

    beforeEach(() => sessionMock.addMockFor(backendRequest(), backendOk))

    it('post forwards to login page', () => postRegistration(testEmail, testPassword, testPassword)
      .redirects(false)
      .then(res => {
        res.should.have.status(303)
        res.should.have.header('location', /.*login$/)
      })
    )

    it('successful registration', () => postRegistration(testEmail, testPassword, testPassword)
      .then(orchestrator.withHtml).then(res => {
        res.status.should.equal(200)
        res.html.pageTitle().should.equal('mex login')
        sessionMock.assertReceived(backendRequest())
      })
    )

    it('password + confirmation not matching', () => { })
    it('unsuccessful registration from backend', () => { })
    it('error from backend', () => { })
  })
})
