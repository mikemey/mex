const { wsmessages } = require('../utils')
const { Credentials } = require('./model')

const isUserExists = err => err.name === 'UserExistsError'

const KW_REGISTER = 'register'
const responses = wsmessages.withAction(KW_REGISTER)

const register = message => Credentials
  .register({ email: message.email }, message.password)
  .then(responses.ok)
  .catch(err => {
    if (isUserExists(err)) { return responses.nok(`duplicate name [${message.email}]`) }
    throw err
  })

module.exports = { register, KW_REGISTER }
