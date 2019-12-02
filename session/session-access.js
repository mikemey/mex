const { sign, verify, TokenExpiredError } = require('jsonwebtoken')
const NodeCache = require('node-cache')

const { wsmessages } = require('../utils')
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
const verifyOK = verifyResponse.ok()
const verifyNOK = verifyResponse.nok()
const revokeOK = wsmessages.withAction(KW_REVOKE).ok()

const authenticate = Credentials.authenticate()

const createAccessService = (secretBuffer, jwtExpirationSecs, logFunc) => {
  const jwtcache = new NodeCache({
    stdTTL: jwtExpirationSecs,
    useClones: false
  })

  const registerUser = message => Credentials.register({ email: message.email }, message.password)
    .then(() => registerOK)
    .catch(err => {
      logFunc(err.message)
      if (isUserExists(err)) { return registerResponse.nok(`duplicate name [${message.email}]`) }
      throw err
    })

  const loginUser = message => authenticate(message.email, message.password)
    .then(({ user, error }) => {
      if (error) { return loginResponse.nok(`login failed [${message.email}]: ${error.message}`) }

      const jwt = sign({ id: user.id, email: user.email }, secretBuffer, { expiresIn: jwtExpirationSecs })
      return loginResponse.ok({ id: user.id, email: user.email, jwt })
    })

  const verifyToken = message => new Promise((resolve, reject) => {
    if (jwtcache.get(message.jwt)) { return resolve(verifyNOK) }
    verify(message.jwt, secretBuffer, err => {
      if (err) {
        logFunc('jwt verification failed:', err.message)
        const response = err instanceof TokenExpiredError
          ? verifyResponse.nok(err.message)
          : verifyNOK
        return resolve(response)
      }
      resolve(verifyOK)
    })
  })

  const revokeToken = message => {
    jwtcache.set(message.jwt, true)
    return revokeOK
  }

  const stop = () => {
    jwtcache.close()
    jwtcache.flushAll()
  }

  return { registerUser, loginUser, verifyToken, revokeToken, stop }
}

module.exports = { createAccessService, KW_REGISTER, KW_LOGIN, KW_VERIFY, KW_REVOKE }
