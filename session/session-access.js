const jsonwebtoken = require('jsonwebtoken')

const { wsmessages } = require('../utils')
const { Credentials } = require('./model')

const isUserExists = err => err.name === 'UserExistsError'

const KW_LOGIN = 'login'
const KW_REGISTER = 'register'
const KW_VERIFY = 'verify'

const registerResponse = wsmessages.withAction(KW_REGISTER)
const registerOK = registerResponse.ok()
const loginResponse = wsmessages.withAction(KW_LOGIN)
const verifyResponse = wsmessages.withAction(KW_VERIFY)
const verifyOK = verifyResponse.ok()
const verifyNOK = verifyResponse.nok()

const authenticate = Credentials.authenticate()

const createAccessService = (secretBuffer, jwtOpts, logFunc) => {
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

      const jwt = jsonwebtoken.sign({ id: user.id, email: user.email }, secretBuffer, jwtOpts)
      return loginResponse.ok({ id: user.id, email: user.email, jwt })
    })

  const verify = message => new Promise((resolve, reject) => {
    jsonwebtoken.verify(message.jwt, secretBuffer, (err, decoded) => {
      if (err) {
        logFunc('jwt verification failed:', err.message)
        return resolve(verifyNOK)
      }
      resolve(verifyOK)
    })
  })

  return { registerUser, loginUser, verify }
}

module.exports = { createAccessService, KW_REGISTER, KW_LOGIN, KW_VERIFY }
