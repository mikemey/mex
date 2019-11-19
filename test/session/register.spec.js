const { TestClient, tus } = require('../utils')

const RegisterService = require('../../src/session/register')

describe('Register service', () => {
  const testClient = new TestClient()
  const registerSvc = new RegisterService(testClient.config)

  before(() => registerSvc.start())
  after(() => registerSvc.stop())
  afterEach(() => testClient.close())

  const registerReq = (name = tus.randEmail(), pass = tus.randPass(), action = 'register') => {
    return { action, name, pass }
  }

  const assertRegisterOk = result => result.should.deep.equal({
    action: 'register', status: 'ok'
  })

  const assertNok = message => result => result.should.deep.equal({
    status: 'nok', message
  })

  describe('successful registration', () => {
    it('single user', () => {
      const request = registerReq()
      return testClient.connect()
        .then(() => testClient.send(request))
        .then(assertRegisterOk)
    })

    it('multiple user', () => {
      const r1 = registerReq()
      const r2 = registerReq()
      return testClient.connect()
        .then(() => testClient.send(r1)).then(assertRegisterOk)
        .then(() => testClient.send(r2)).then(assertRegisterOk)
    })
  })

  describe('rejected registration', () => {
    afterEach(() => testClient.close())

    it('reject too short password', () => {
    })

    it('reject duplicate user name', () => {
      const username = tus.randEmail()
      const req = registerReq(username)
      return testClient.connect()
        .then(() => testClient.send(req)).then(assertRegisterOk)
        .then(() => testClient.send(req)).then(assertNok(`duplicate name [${username}]`))
    })
  })

  describe('fatal client errors', () => {
    it('reject unknown action', () => {
      const req = registerReq()
      req.action = 'test'
      return testClient.connect()
        .then(() => testClient.send(req)).then(assertNok('unknown action'))
        .then(() => {
          testClient.isOpen().should.equal(false, 'closed client socket')
        })
    })

    it('reject when unknown request properties', () => {
    })
  })
})
