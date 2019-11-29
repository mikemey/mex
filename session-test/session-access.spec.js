const { trand } = require('../testtools')
const { WSClient } = require('../security')

const { SessionService, model } = require('../session')
const {
  dbconnection, randomString, wsmessages: { OK_STATUS, NOK_STATUS, ERROR_STATUS }
} = require('../utils')

describe('SessionService register', () => {
  const testToken = 'session-service-testtoken'
  const port = 12021
  const path = '/session-registration'
  const url = `ws://localhost:${port}${path}`
  const testConfig = { port, path, authorizedTokens: [testToken] }

  const dbconfig = {
    url: 'mongodb://127.0.0.1:27017', name: 'mex-test'
  }
  const registerSvc = new SessionService(testConfig)
  const wsClient = new WSClient({ url, authToken: testToken, timeout: 1500 })

  before(() => dbconnection.connect(dbconfig.url, dbconfig.name)
    .then(() => model.Credentials.deleteMany())
    .then(() => registerSvc.start())
  )
  after(() => registerSvc.stop().then(() => dbconnection.close()))
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

  describe('ejects registration:', () => {
    it('duplicate user name', () => {
      const request = registerReq()
      return wsClient.send(request).then(assertRegisterOk)
        .then(() => expectNokResponse(request, `duplicate name [${request.email}]`))
    })

    it('username not an email', () => {
      const request = registerReq({ email: randomString(12) })
      return expectNokResponse(request, 'email invalid')
    })

    it('password too short', () => {
      const request = registerReq({ password: randomString(7) })
      return expectNokResponse(request, 'password invalid')
    })

    it('password too long', () => {
      const request = registerReq({ password: randomString(51) })
      return expectNokResponse(request, 'password invalid')
    })
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
