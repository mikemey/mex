const TestClient = require('../testClient')

const RegisterService = require('../../src/session/register')

describe('Register service', () => {
  const testClient = new TestClient()
  const registerSvc = new RegisterService(testClient.config)

  before(() => registerSvc.start())
  after(() => registerSvc.stop())

  afterEach(() => testClient.close())

  const registerReq = (name, pass, action = 'register') => {
    return { action, name, pass }
  }

  it('allows user registration', () => {
    const request = registerReq('first@email', 'firstpw')
    return testClient.connect()
      .then(() => testClient.send(request))
      .then(result => {
        result.action.should.equal(request.action)
        result.status.should.equal('ok')
      })
  })
})
