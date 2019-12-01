const orchestrator = require('./useraccount.orch')
const { wsmessages } = require('../utils')

describe('UserAccount login', () => {
  const agent = orchestrator.agent()
  const sessionMock = orchestrator.sessionMock
  const loginAction = wsmessages.withAction('login')

  before(() => orchestrator.start().then(() => agent.get('/version')))
  after(() => orchestrator.stop())
  beforeEach(() => sessionMock.reset())
  afterEach(() => sessionMock.errorCheck())

  const testEmail = 'holla_holla@bla.com'
  const testPassword = 'mysecret'

  const postLogin = ({ email = testEmail, password = testPassword } = {}) => agent.post('/login')
    .send(`email=${email}`).send(`password=${password}`)

  const expectLoginError = (errMessage, sessionMockCalled = 0) => res => {
    res = orchestrator.withHtml(res)
    res.status.should.equal(200)
    res.html.pageTitle().should.equal('mex login')
    res.html.$('#error').text().should.equal(errMessage)
    sessionMock.counter.should.equal(sessionMockCalled)
  }

  describe('login form parameter checks', () => {
    const testData = [
      { title: 'email not valid', post: { email: 'wrong' }, expectedError: 'email invalid' },
      { title: 'empty email', post: { email: '' }, expectedError: 'email invalid' },
      { title: 'password empty', post: { password: '' }, expectedError: 'password invalid' }
    ]

    testData.forEach(test => {
      it(test.title, () => postLogin(test.post).then(expectLoginError(test.expectedError)))
    })
  })

  describe('calls to session service', () => {
    const backendRequest = loginAction.build({ email: testEmail, password: testPassword })

    const backendResponseOk = loginAction.ok({ id: 12345, email: 'hello@bla.com' })
    const backendResponseNok = message => loginAction.nok(message)
    const backendResponseError = message => wsmessages.error(message)

    it('post forwards to main user page', () => {
      sessionMock.addMockFor(backendRequest, backendResponseOk)
      return postLogin().redirects(false)
        .then(res => {
          res.should.have.status(303)
          res.should.have.header('location', 'index')
        })
    })

    it('successful login', () => {
      sessionMock.addMockFor(backendRequest, backendResponseOk)
      return postLogin()
        .then(orchestrator.withHtml).then(res => {
          res.status.should.equal(200)

          res.html.pageTitle().should.equal('mex home')
          sessionMock.assertReceived(backendRequest)
        })
    })

    it('unsuccessful login from backend', () => {
      const errorMessage = 'test-unsuccessful'
      sessionMock.addMockFor(backendRequest, backendResponseNok(errorMessage))
      return postLogin().then(expectLoginError(errorMessage, 1))
    })

    it('error from backend', () => {
      const errorMessage = 'test-error'
      sessionMock.addMockFor(backendRequest, backendResponseError(errorMessage))
      return postLogin().then(expectLoginError('service unavailable', 1))
    })
  })
})
