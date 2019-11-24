const { trand } = require('../testtools')
const { WSClient } = require('../security')

const { RegisterService, model } = require('../session')
const { dbconnection } = require('../utils')

describe('SessionService register', () => {
  const testToken = 'sessionservice-registration'
  const port = 12021
  const path = '/session-registration'
  const url = `ws://localhost:${port}${path}`
  const testConfig = { port, path, authorizedTokens: [testToken] }

  const wsClient = new WSClient({ url, authToken: testToken, timeout: 500 })

  const dbconfig = {
    url: 'mongodb://127.0.0.1:27017', name: 'mex-test'
  }
  const registerSvc = new RegisterService(testConfig)

  before(() => dbconnection.connect(dbconfig.url, dbconfig.name)
    .then(() => model.Credentials.deleteMany())
    .then(() => registerSvc.start())
  )
  after(() => registerSvc.stop().then(() => dbconnection.close()))
  afterEach(() => wsClient.stop())

  const registerReq = (email = trand.randEmail(), password = trand.randPass(), action = 'register') => {
    return { action, email, password }
  }

  const assertRegisterOk = result => result.should.deep.equal({
    action: 'register', status: 'ok'
  })

  const expectNokResponse = (req, message) => wsClient.send(req)
    .then(result => result.should.deep.equal({ action: 'register', status: 'nok', message }))
    .then(() => wsClient._isConnected())
    .then(isConnected => isConnected.should.equal(true, 'open socket'))

  const expectError = req => wsClient.send(req)
    .then(result => result.should.deep.equal({ status: 'error', message: 'invalid request' }))
    .then(() => wsClient._isConnected())
    .then(isConnected => isConnected.should.equal(false, 'closed socket'))

  describe('successful registration', () => {
    it('single user', () => {
      const request = registerReq()
      return wsClient.send(request)
        .then(assertRegisterOk)
        .then(() => model.Credentials.findByUsername(request.email))
        .then(creds => {
          creds.email.should.equal(request.email)
        })
    })

    it('multiple user', () => {
      const r1 = registerReq()
      const r2 = registerReq()
      return wsClient.send(r1).then(assertRegisterOk)
        .then(() => wsClient.send(r2)).then(assertRegisterOk)
    })
  })

  describe('rejects registration:', () => {
    it('duplicate user name', () => {
      const request = registerReq()
      return wsClient.send(request).then(assertRegisterOk)
        .then(() => expectNokResponse(request, `duplicate name [${request.email}]`))
    })

    it('username not an email', () => {
      const request = registerReq(trand.randStr(7))
      return expectNokResponse(request, 'email invalid')
    })

    it('password too short', () => {
      const request = registerReq(undefined, trand.randStr(7))
      return expectNokResponse(request, 'password invalid')
    })

    it('password too long', () => {
      const request = registerReq(undefined, trand.randStr(31))
      return expectNokResponse(request, 'password invalid')
    })
  })

  describe('fatal client errors', () => {
    it('invalid action', () =>
      expectError(registerReq(undefined, undefined, 'registerX'))
    )

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
