const ServiceAuth = require('../security/serviceauth')

class RegisterService extends ServiceAuth {
  constructor (config) {
    super(config.wss)
  }

  received (message) {
    return Promise.resolve({
      action: message.action,
      status: 'ok'
    })
  }
}
module.exports = RegisterService
