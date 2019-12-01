const { wsmessages } = require('../utils')
const { Credentials } = require('./model')

const isUserExists = err => err.name === 'UserExistsError'

const KW_LOGIN = 'login'
const KW_REGISTER = 'register'
const registerResponse = wsmessages.withAction(KW_REGISTER)
const loginResponse = wsmessages.withAction(KW_LOGIN)

const authenticate = Credentials.authenticate()

const registerUser = message => Credentials.register({ email: message.email }, message.password)
  .then(() => registerResponse.ok())
  .catch(err => {
    if (isUserExists(err)) { return registerResponse.nok(`duplicate name [${message.email}]`) }
    throw err
  })

const loginUser = message => authenticate(message.email, message.password)
  .then(({ user, error }) => {
    if (error) { return loginResponse.nok(`login failed [${message.email}]: ${error.message}`) }
    return loginResponse.ok({ id: user.id, email: user.email })
  })

module.exports = { KW_REGISTER, KW_LOGIN, registerUser, loginUser }
