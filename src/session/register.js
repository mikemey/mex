const ServiceAuth = require('../security/serviceauth')
const ClientError = require('../utils/errors')

class RegisterService extends ServiceAuth {
  constructor (config) {
    super(config.wss)
    this.users = []
  }

  received (message) {
    if (message.action === 'register') {
      if (this.users.includes(message.name)) {
        throw new ClientError(`duplicate name [${message.name}]`)
      }
      this.users.push(message.name)
      return { action: message.action, status: 'ok' }
    }
    throw new ClientError('unknown action', true)
  }
}
module.exports = RegisterService
