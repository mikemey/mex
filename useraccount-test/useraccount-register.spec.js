const orchestrator = require('./useraccount.orch')
const { wsmessages } = require('../utils')
const { pwhasher } = require('../test-tools')

describe('UserAccount register', () => {
  const agent = orchestrator.agent()
  const sessionMock = orchestrator.sessionMock
  const registerAction = wsmessages.withAction('register')

  before(() => orchestrator.start().then(() => agent.get('/version')))
  after(() => orchestrator.stop())
  beforeEach(() => sessionMock.reset())
  afterEach(() => sessionMock.errorCheck())

  const testEmail = 'hello@bla.com'
  const testPassword = 'mysecret'

  const postRegistration = ({ email = testEmail, password = testPassword, confirmation = password }) =>
    agent.post('/register')
      .type('form')
      .send({ email, password, confirmation })

  const expectRegistrationOk = expectedBackendRequest => res => {
    const htmlres = orchestrator.withHtml(res)
    htmlres.status.should.equal(200)
    console.log(htmlres.html.$.text())
    htmlres.html.pageTitle().should.equal('mex login')
    sessionMock.assertReceived(expectedBackendRequest)
  }

  const expectRegistrationError = (errMessage, sessionMockCalled = 0) => res => {
    res = orchestrator.withHtml(res)
    res.status.should.equal(200)
    res.html.pageTitle().should.equal('mex registration')
    res.html.$('#error').text().should.equal(errMessage)
    sessionMock.counter.should.equal(sessionMockCalled)
  }

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

  describe('registration form parameter checks', () => {
    const testData = [
      { title: 'email not valid', post: { email: 'wrong' }, expectedError: 'email invalid' },
      { title: 'empty email', post: { email: '' }, expectedError: 'email invalid' },
      { title: 'password + confirmation not matching', post: { confirmation: 'wrong' }, expectedError: 'password and confirmation not matching' },
      { title: 'password too short', post: { password: '1234567', confirmation: '1234567' }, expectedError: 'password invalid' },
      { title: 'password empty', post: { password: '', confirmation: '' }, expectedError: 'password invalid' }
    ]

    testData.forEach(test => {
      it(test.title, () => postRegistration(test.post).then(expectRegistrationError(test.expectedError)))
    })
  })

  describe('registration calls to session service', () => {
    const backendRequest = ({ email = testEmail, password = testPassword } = {}) =>
      registerAction.build({ email, password: pwhasher(password) })

    const backendResponseOk = registerAction.ok()
    const backendResponseNok = message => registerAction.nok(message)
    const backendResponseError = message => wsmessages.error(message)

    it('post forwards to login page', () => {
      sessionMock.addMockFor(backendRequest(), backendResponseOk)
      return postRegistration({}).redirects(false)
        .then(res => {
          res.should.have.status(303)
          res.should.have.header('location', 'login?flag=reg')
        })
    })

    it('successful registration', () => {
      const berequest = backendRequest()
      sessionMock.addMockFor(berequest, backendResponseOk)
      return postRegistration({})
        .then(expectRegistrationOk(berequest))
    })

    it('password allows special characters', () => {
      const password = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
      const berequest = backendRequest({ password })
      sessionMock.addMockFor(berequest, backendResponseOk)
      return postRegistration({ password })
        .then(expectRegistrationOk(berequest))
    })

    it('unsuccessful registration from backend', () => {
      const errorMessage = 'test-unsuccessful'
      sessionMock.addMockFor(backendRequest(), backendResponseNok(errorMessage))
      return postRegistration({}).then(expectRegistrationError(errorMessage, 1))
    })

    it('error from backend', () => {
      const errorMessage = 'test-error'
      sessionMock.addMockFor(backendRequest(), backendResponseError(errorMessage))
      return postRegistration({}).then(expectRegistrationError('service unavailable', 1))
    })

    it('backend timeout', () => {
      sessionMock.addMockFor(backendRequest(), new Promise(resolve => {
        setTimeout(resolve, 100, {})
      }))
      return postRegistration({}).then(expectRegistrationError('service unavailable', 1))
    })
  })
})