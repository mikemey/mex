const chai = require('chai')
chai.use(require('chai-string'))
const jsonwebtoken = require('jsonwebtoken')

const {
  sessionConfig, wsClient, registeredUser, startService, stopService, loginTestUser, loginRequest
} = require('./session-test-setup')

const {
  randomString, wsmessages: { OK_STATUS, NOK_STATUS, ERROR_STATUS }
} = require('../utils')

describe('SessionService login', () => {
  before(startService)
  after(stopService)
  afterEach(() => wsClient.stop())

  const expectNokResponse = (req, message) => wsClient.send(req)
    .then(result => result.should.deep.equal({ action: 'login', status: NOK_STATUS, message }))

  const expectError = req => wsClient.send(req)
    .then(result => result.should.deep.equal({ status: ERROR_STATUS, message: 'invalid request' }))

  describe('valid requests', () => {
    it('successful login', () => loginTestUser()
      .then(result => {
        result.action.should.equal('login')
        result.status.should.equal(OK_STATUS)

        const secretBuffer = Buffer.from(sessionConfig.jwtkey, 'base64')
        const payload = jsonwebtoken.decode(result.jwt, secretBuffer)
        payload.id.should.equal(registeredUser.id)
        payload.email.should.equal(registeredUser.email)
      })
    )

    it('failed login', () => expectNokResponse(loginRequest({ password: 'wrongpass' }),
      `login failed [${registeredUser.email}]: Password or username is incorrect`
    ))
  })

  describe('error responses', () => {
    it('username not an email', () => expectNokResponse(loginRequest({ email: randomString(12) }), 'email invalid'))
    it('password too short', () => expectNokResponse(loginRequest({ password: randomString(7) }), 'password invalid'))
    it('password too long', () => expectNokResponse(loginRequest({ password: randomString(51) }), 'password invalid'))
  })

  describe('fatal client errors', () => {
    it('invalid action', () => expectError(loginRequest({ action: 'loginX' })))

    it('additional request parameters', () => {
      const req = loginRequest()
      req.additional = 'param'
      return expectError(req)
    })

    it('missing action parameter', () => {
      const req = loginRequest()
      delete req.action
      return expectError(req)
    })

    it('missing email parameter', () => {
      const req = loginRequest()
      delete req.email
      return expectError(req)
    })

    it('missing password parameter', () => {
      const req = loginRequest()
      delete req.password
      return expectError(req)
    })
  })
})
