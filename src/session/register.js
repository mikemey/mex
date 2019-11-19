const ServiceAuth = require('../security/serviceauth')
const { errors, wsmessages } = require('../utils')
const ClientError = errors.ClientError
const { Account } = require('./model')

const isUserExists = err => err.name === 'UserExistsError'

class RegisterService extends ServiceAuth {
  constructor (wssconfig) {
    super(wssconfig)
    this.users = []
  }

  received (message) {
    if (message.action === 'register') {
      return Account.register({ username: message.name }, message.pass)
        .then(() => wsmessages.ok(message.action))
        .catch(err => {
          if (isUserExists(err)) { return wsmessages.nok(`duplicate name [${message.name}]`) }
          throw err
        })
    }
    throw new ClientError('unknown action')
  }
}
module.exports = RegisterService
