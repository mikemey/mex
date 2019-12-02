const chai = require('chai')
chai.use(require('chai-string'))

const { sessionService, wsClient, startService, stopService, loginTestUser, outdatedJwt } = require('./session-test-setup')
const { wsmessages: { OK_STATUS, NOK_STATUS, ERROR_STATUS } } = require('../utils')

describe('SessionService revoke', () => {
  let testJwt = null

  before(() => startService()
    .then(loginTestUser)
    .then(res => { testJwt = res.jwt }))
  after(stopService)
  afterEach(() => wsClient.stop()
    .then(clearRevokedTokenCache)
  )

  const revokeRequest = ({ jwt = testJwt, action = 'revoke' } = {}) => {
    return { action, jwt }
  }
  const clearRevokedTokenCache = () =>
    sessionService.accessService.revokedJwtCache.flushAll()
  const expectRevokedTokenCacheSize = count =>
    sessionService.accessService.revokedJwtCache.getStats().keys.should.equal(count)

  const expectOkResponse = req => wsClient.send(req)
    .then(result => result.should.deep.equal({ action: 'revoke', status: OK_STATUS }))

  const expectError = req => wsClient.send(req)
    .then(result => result.should.deep.equal({ status: ERROR_STATUS, message: 'invalid request' }))

  describe('valid requests', () => {
    it('revoke existing', () => expectOkResponse(revokeRequest({ jwt: testJwt }))
      .then(() => wsClient.send(({ jwt: testJwt, action: 'verify' })))
      .then(result => {
        result.should.deep.equal({ action: 'verify', status: NOK_STATUS })
        expectRevokedTokenCacheSize(1)
      })
    )

    it('revoke unknown token', () => expectOkResponse(revokeRequest({ jwt: '12345678901234567890' }))
      .then(() => expectRevokedTokenCacheSize(0))
    )

    it('revoke expired token', () => expectOkResponse(revokeRequest({ jwt: outdatedJwt }))
      .then(() => expectRevokedTokenCacheSize(0))
    )
  })

  describe('fatal client errors', () => {
    it('invalid action', () => expectError(revokeRequest({ action: 'revokeX' })))

    it('missing action parameter', () => {
      const req = revokeRequest()
      delete req.action
      return expectError(req)
    })

    it('missing jwt parameter', () => {
      const req = revokeRequest()
      delete req.jwt
      return expectError(req)
    })

    it('empty jwt', () => expectError(revokeRequest({ jwt: '' })))
    it('too short jwt', () => expectError(revokeRequest({ jwt: '1234567890123456789' })))

    it('additional request parameters', () => {
      const req = revokeRequest()
      req.additional = 'param'
      return expectError(req)
    })
  })
})
