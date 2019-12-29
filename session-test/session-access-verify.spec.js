const chai = require('chai')
chai.use(require('chai-string'))

const { wsClient, startService, stopService, loginTestUser, outdatedJwt, registeredUser } = require('./session-test-setup')
const { messages: { OK_STATUS, NOK_STATUS, ERROR_STATUS } } = require('../utils')

describe('SessionService verify', () => {
  let testJwt = null

  before(() => startService()
    .then(loginTestUser)
    .then(res => { testJwt = res.jwt }))
  after(stopService)
  afterEach(() => wsClient.stop())

  const verifyReq = ({ jwt = testJwt, action = 'verify' } = {}) => {
    return { action, jwt }
  }

  const expectNokResponse = (req, message) => wsClient.send(req)
    .then(result => {
      const expected = { action: 'verify', status: NOK_STATUS }
      if (message) { expected.message = message }
      result.should.deep.equal(expected)
    })

  const expectError = req => wsClient.send(req)
    .then(result => result.should.deep.equal({ status: ERROR_STATUS, message: 'invalid request' }))

  describe('valid requests', () => {
    it('successful verification', () => wsClient.send(verifyReq())
      .then(result => {
        result.action.should.equal('verify')
        result.status.should.equal(OK_STATUS)
        result.user.id.should.equal(registeredUser.id)
        result.user.email.should.equal(registeredUser.email)
      })
    )

    it('failed verification - tampered jwt', () => {
      const [header, payload, signature] = testJwt.split('.')
      const tamperedPayload = 'x' + payload.substring(1)
      const tamperedJwt = `${header}.${tamperedPayload}.${signature}`

      return expectNokResponse(verifyReq({ jwt: tamperedJwt }))
    })

    it('failed verification - jwt expired', () => expectNokResponse(verifyReq(
      { jwt: outdatedJwt }), 'jwt expired')
    )
  })

  describe('fatal client errors', () => {
    it('invalid action', () => expectError(verifyReq({ action: 'verifyx' })))

    it('missing action parameter', () => {
      const req = verifyReq()
      delete req.action
      return expectError(req)
    })

    it('missing jwt parameter', () => {
      const req = verifyReq()
      delete req.jwt
      return expectError(req)
    })

    it('empty jwt', () => expectError(verifyReq({ jwt: '' })))
    it('too short jwt', () => expectError(verifyReq({ jwt: '1234567890123456789' })))

    it('additional request parameters', () => {
      const req = verifyReq()
      req.additional = 'param'
      return expectError(req)
    })
  })
})
