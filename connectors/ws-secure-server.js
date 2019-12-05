const Joi = require('@hapi/joi')

const { WSServer, WSClient } = require('../connectors')

const {
  wsmessages: { error, withAction, OK_STATUS, NOK_STATUS }, Validator, errors: { ClientError }
} = require('../utils')

const configSchema = Joi.object({
  sessionService: Joi.object().required()
}).unknown()

const jwtSchema = Joi.object({
  jwt: Validator.jwt()
}).unknown()

const jwtCheck = Validator.createCheck(jwtSchema, {
  onError: () => { throw new ClientError('invalid request', error('invalid request'), false) }
})

const verifyMessages = withAction('verify')
const sessionServiceUnavailable = error('session-service unavailable')

class WSSecureServer extends WSServer {
  constructor (config) {
    Validator.oneTimeValidation(configSchema, config)
    const serverConfig = Object.assign({}, config)
    const sessionClientConfig = serverConfig.sessionService
    delete serverConfig.sessionService
    super(serverConfig)

    this.sessionClient = new WSClient(sessionClientConfig)
  }

  stop () {
    return this.sessionClient.stop().then(super.stop())
  }

  async received (message) {
    jwtCheck(message)
    return this.sessionClient
      .send(verifyMessages.build({ jwt: message.jwt }))
      .then(verification => {
        switch (verification.status) {
          case OK_STATUS: return this.secureReceived(message)
          case NOK_STATUS: return verification
          default: return sessionServiceUnavailable
        }
      })
      .catch(() => sessionServiceUnavailable)
  }

  secureReceived (message) { return Promise.resolve(message) }
}

module.exports = WSSecureServer