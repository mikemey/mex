const { sign, verify, TokenExpiredError } = require('jsonwebtoken')
const NodeCache = require('node-cache')

const { Logger, wsmessages } = require('../utils')

const { Credentials } = require('./model')

const isUserExists = err => err.name === 'UserExistsError'

const KW_LOGIN = 'login'
const KW_REGISTER = 'register'
const KW_VERIFY = 'verify'
const KW_REVOKE = 'revoke'

const registerResponse = wsmessages.withAction(KW_REGISTER)
const registerOK = registerResponse.ok()
const loginResponse = wsmessages.withAction(KW_LOGIN)
const verifyResponse = wsmessages.withAction(KW_VERIFY)
const verifyNOK = verifyResponse.nok()
const revokeOK = wsmessages.withAction(KW_REVOKE).ok()

const authenticate = Credentials.authenticate()

const createAccessService = (secretBuffer, jwtExpirationSecs) => {
  const logger = Logger('AccessService')
  const revokedJwtCache = new NodeCache({
    stdTTL: jwtExpirationSecs,
    useClones: false
  })

  const registerUser = message => Credentials.register({ email: message.email }, message.password)
    .then(() => registerOK)
    .catch(err => {
      logger.error(err.message)
      if (isUserExists(err)) { return registerResponse.nok(`duplicate email [${message.email}]`) }
      throw err
    })

  const loginUser = message => authenticate(message.email, message.password)
    .then(({ user, error }) => {
      if (error) { return loginResponse.nok(`login failed [${message.email}]: ${error.message}`) }

      const jwt = sign({ id: user.id, email: user.email }, secretBuffer, { expiresIn: jwtExpirationSecs })
      return loginResponse.ok({ id: user.id, email: user.email, jwt })
    })

  const verifyToken = message => new Promise((resolve, reject) => {
    if (revokedJwtCache.get(message.jwt)) { return resolve(verifyNOK) }
    verify(message.jwt, secretBuffer, (err, payload) => {
      if (err) {
        logger.error('jwt verification failed:', err.message)
        const response = err instanceof TokenExpiredError
          ? verifyResponse.nok(err.message)
          : verifyNOK
        return resolve(response)
      }
      resolve(verifyResponse.ok({ user: payload }))
    })
  })

  const revokeToken = message => new Promise((resolve, reject) => {
    verify(message.jwt, secretBuffer, err => {
      err
        ? logger.error('revoke jwt failed:', err.message)
        : revokedJwtCache.set(message.jwt, true)
      resolve(revokeOK)
    })
  })

  return { registerUser, loginUser, verifyToken, revokeToken, revokedJwtCache }
}

module.exports = { createAccessService, KW_REGISTER, KW_LOGIN, KW_VERIFY, KW_REVOKE }
