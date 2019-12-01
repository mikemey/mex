const chai = require('chai')
chai.use(require('chai-string'))
const jsonwebtoken = require('jsonwebtoken')

const SessionTestSetup = require('./session-test-setup')

const {
  randomString, wsmessages: { OK_STATUS, NOK_STATUS, ERROR_STATUS }
} = require('../utils')

describe('SessionService login', () => {
  const wsClient = SessionTestSetup.wsClient
  const testUser = SessionTestSetup.registeredUser

  before(SessionTestSetup.start)
  after(SessionTestSetup.stop)
  afterEach(() => wsClient.stop())

  const loginReq = ({ email = testUser.email, password = testUser.password, action = 'login' } = {}) => {
    return { action, email, password }
  }

  const expectNokResponse = (req, message) => wsClient.send(req)
    .then(result => result.should.deep.equal({ action: 'login', status: NOK_STATUS, message }))

  const expectError = req => wsClient.send(req)
    .then(result => result.should.deep.equal({ status: ERROR_STATUS, message: 'invalid request' }))

  describe('valid requests', () => {
    it('successful login', () => wsClient.send(loginReq())
      .then(result => {
        result.action.should.equal('login')
        result.status.should.equal(OK_STATUS)

        const secretBuffer = Buffer.from(SessionTestSetup.sessionConfig.jwtkey, 'base64')
        const payload = jsonwebtoken.verify(result.jwt, secretBuffer)
        payload.id.should.equal('5de363fbd0f61042035dc603')
        payload.email.should.equal(testUser.email)
      })
    )

    it('failed login', () => wsClient.send(loginReq({ password: 'wrongpass' }))
      .then(result => {
        result.action.should.equal('login')
        result.status.should.equal(NOK_STATUS)
        result.message.should.startWith(`login failed [${testUser.email}]`)
      }))
  })

  describe('error responses', () => {
    it('username not an email', () => {
      const request = loginReq({ email: randomString(12) })
      return expectNokResponse(request, 'email invalid')
    })

    it('password too short', () => {
      const request = loginReq({ password: randomString(7) })
      return expectNokResponse(request, 'password invalid')
    })

    it('password too long', () => {
      const request = loginReq({ password: randomString(51) })
      return expectNokResponse(request, 'password invalid')
    })
  })

  describe('fatal client errors', () => {
    it('invalid action', () => expectError(loginReq({ action: 'loginX' })))

    it('additional request parameters', () => {
      const req = loginReq()
      req.additional = 'param'
      return expectError(req)
    })

    it('missing action parameter', () => {
      const req = loginReq()
      delete req.action
      return expectError(req)
    })

    it('missing email parameter', () => {
      const req = loginReq()
      delete req.email
      return expectError(req)
    })

    it('missing password parameter', () => {
      const req = loginReq()
      delete req.password
      return expectError(req)
    })
  })
})
