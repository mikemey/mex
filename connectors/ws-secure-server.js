const Joi = require('@hapi/joi')

const WSServer = require('./wsserver')
// const WSClient = require('./wsclient')

const {
  wsmessages: { error, withAction, OK_STATUS, NOK_STATUS }, Validator, errors: { ClientError }
} = require('../utils')

const configSchema = Joi.object({
  wsserver: Joi.object().required(),
  sessionService: Joi.object().required()
})

const jwtSchema = Joi.object({
  jwt: Validator.jwt()
}).unknown()

const jwtCheck = Validator.createCheck(jwtSchema, {
  onError: () => { throw new ClientError('invalid request', error('invalid request'), false) }
})

const verifyMessages = withAction('verify')
const sessionServiceUnavailable = error('session-service unavailable')
const userUnavailable = error('session-service user unavailable')

class WSSecureServer extends WSServer {
  constructor (config) {
    Validator.oneTimeValidation(configSchema, config)
    super(config.wsserver)

    // const sessionClientCategory = `${this.constructor.name} SessionClient`
    // this.sessionClient = new WSClient(config.sessionService, sessionClientCategory)
  }

  stop () {
    return this.sessionClient.stop().then(super.stop())
  }

  async received (message) {
    jwtCheck(message)
    const result = await this.sessionClient
      .send(verifyMessages.build({ jwt: message.jwt }))
      .catch(err => {
        this.logger.error('verification error:', err)
        return sessionServiceUnavailable
      })
    switch (result.status) {
      case OK_STATUS: {
        if (!result.user) { return userUnavailable }
        delete message.jwt
        message.user = result.user
        return this.secureReceived(message)
      }
      case NOK_STATUS: return result
      default: return sessionServiceUnavailable
    }
  }

  secureReceived (message) { return Promise.resolve(message) }
}

module.exports = WSSecureServer
