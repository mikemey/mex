const { model } = require('../session')

const { trand } = require('../test-tools')
const SessionTestSetup = require('./session-test-setup')

const {
  randomString, wsmessages: { OK_STATUS, NOK_STATUS, ERROR_STATUS }
} = require('../utils')

describe('SessionService register', () => {
  const wsClient = SessionTestSetup.wsClient

  before(SessionTestSetup.startService)
  after(SessionTestSetup.stopService)
  afterEach(() => wsClient.stop())

  const registerReq = ({ email = trand.randEmail(), password = trand.randPass(), action = 'register' } = {}) => {
    return { action, email, password }
  }

  const assertRegisterOk = result => result.should.deep.equal({
    action: 'register', status: OK_STATUS
  })

  const expectNokResponse = (req, message) => wsClient.send(req)
    .then(result => result.should.deep.equal({ action: 'register', status: NOK_STATUS, message }))

  const expectError = req => wsClient.send(req)
    .then(result => result.should.deep.equal({ status: ERROR_STATUS, message: 'invalid request' }))

  describe('successful registration', () => {
    it('single user', () => {
      const request = registerReq()
      return wsClient.send(request)
        .then(assertRegisterOk)
        .then(() => model.Credentials.findByUsername(request.email))
        .then(creds => creds.email.should.equal(request.email))
    })

    it('multiple user', () => {
      const r1 = registerReq()
      const r2 = registerReq()
      return Promise.all([wsClient.send(r1), wsClient.send(r2)])
        .then(results => {
          assertRegisterOk(results[0])
          assertRegisterOk(results[1])
        })
    })

    it('password allows special characters', () => wsClient.send(registerReq({
      password: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
    })).then(assertRegisterOk))
  })

  describe('error responses', () => {
    it('duplicate user name', () => {
      const request = registerReq()
      return wsClient.send(request).then(assertRegisterOk)
        .then(() => expectNokResponse(request, `duplicate name [${request.email}]`))
    })

    it('username not an email', () => expectNokResponse(registerReq({ email: randomString(12) }), 'email invalid'))
    it('password too short', () => expectNokResponse(registerReq({ password: randomString(7) }), 'password invalid'))
    it('password too long', () => expectNokResponse(registerReq({ password: randomString(51) }), 'password invalid'))
  })

  describe('fatal client errors', () => {
    it('invalid action', () => expectError(registerReq({ action: 'registerX' })))

    it('additional request parameters', () => {
      const req = registerReq()
      req.additional = 'param'
      return expectError(req)
    })

    it('missing action parameter', () => {
      const req = registerReq()
      delete req.action
      return expectError(req)
    })

    it('missing email parameter', () => {
      const req = registerReq()
      delete req.email
      return expectError(req)
    })

    it('missing password parameter', () => {
      const req = registerReq()
      delete req.password
      return expectError(req)
    })
  })
})
