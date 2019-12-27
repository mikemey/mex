const orchestrator = require('./useraccount.orch')
const { wsmessages } = require('../utils')
const { pwhasher } = require('../test-tools')

describe('UserAccount login', () => {
  let useragent
  let sessionMock
  const loginAction = wsmessages.withAction('login')
  const verifyAction = wsmessages.withAction('verify')

  before(async () => ({ useragent, sessionMock } = await orchestrator.start()))
  after(() => orchestrator.stop())

  const testEmail = 'holla_holla@bla.com'
  const testPassword = 'mysecret'

  const postLogin = ({ email = testEmail, password = testPassword } = {}) => useragent.post('/login')
    .type('form').send({ email, password })

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
    const dummyJwt = 'abc.def.ghi'
    const beLoginRequest = loginAction.build({ email: testEmail, password: pwhasher(testPassword) })
    const beVerifyRequest = verifyAction.build({ jwt: dummyJwt })

    const beLoginResponseOk = loginAction.ok({ jwt: dummyJwt })
    const beLoginResponseNok = message => loginAction.nok(message)
    const beResponseError = message => wsmessages.error(message)
    const beVerifyResponseOk = verifyAction.ok({ user: { email: 'test@test.com' } })
    const beVerifyResponseNok = verifyAction.nok()
    const beVerifyResponseError = message => wsmessages.error(message)

    describe('successful login', () => {
      beforeEach(() => sessionMock.addMockFor(beLoginRequest, beLoginResponseOk))

      it('post forwards to main user page', () => postLogin().redirects(false)
        .then(res => {
          res.should.have.status(303)
          res.should.have.header('location', orchestrator.httpserverConfig.path + '/index')
        })
      )

      it('successful jwt verification', () => {
        sessionMock.addMockFor(beVerifyRequest, beVerifyResponseOk)
        return postLogin()
          .then(orchestrator.withHtml).then(res => {
            res.status.should.equal(200)

            res.html.pageTitle().should.equal('mex home')
            sessionMock.assertReceived(beLoginRequest, beVerifyRequest)
            sessionMock.counter.should.equal(2)
          })
      })

      const expectVerificationError = expectedMessage => res => {
        const htmlres = orchestrator.withHtml(res)
        htmlres.status.should.equal(200)
        htmlres.html.pageTitle().should.equal('mex login')
        htmlres.html.$('#message').text().should.equal(expectedMessage)
        sessionMock.assertReceived(beLoginRequest, beVerifyRequest)
        sessionMock.counter.should.equal(2)
      }

      it('failed jwt verification', () => {
        sessionMock.addMockFor(beVerifyRequest, beVerifyResponseNok)
        return postLogin()
          .then(expectVerificationError('Please log-in'))
      })

      it('error jwt verification', () => {
        sessionMock.addMockFor(beVerifyRequest, beVerifyResponseError('jwt-verify-error'))
        return postLogin()
          .then(expectVerificationError('Service unavailable'))
      })
    })

    describe('unsuccessful login', () => {
      it('nok response from backend', () => {
        const errorMessage = 'test-unsuccessful'
        sessionMock.addMockFor(beLoginRequest, beLoginResponseNok(errorMessage))
        return postLogin().then(expectLoginError(errorMessage, 1))
      })

      it('error response from backend', () => {
        sessionMock.addMockFor(beLoginRequest, beResponseError('test-error'))
        return postLogin().then(expectLoginError('Service unavailable', 1))
      })
    })
  })
})
