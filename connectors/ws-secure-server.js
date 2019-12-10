const Joi = require('@hapi/joi')

const WSServer = require('./wsserver')
const WSClient = require('./wsclient')

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
    const configCopy = Object.assign({}, config)
    delete configCopy.sessionService
    super(configCopy)

    const sessionClientCategory = `${this.constructor.name} SessionClient`
    this.sessionClient = new WSClient(config.sessionService, sessionClientCategory)
  }

  stop () {
    return this.sessionClient.stop().then(super.stop())
  }

  async received (message) {
    jwtCheck(message)
    return this.sessionClient
      .send(verifyMessages.build({ jwt: message.jwt }))
      .catch(err => {
        this.log('verification error:', err)
        return sessionServiceUnavailable
      })
      .then(verification => {
        message.user = verification.user
        delete message.jwt
        switch (verification.status) {
          case OK_STATUS: return this.secureReceived(message)
          case NOK_STATUS: return verification
          default: return sessionServiceUnavailable
        }
      })
  }

  secureReceived (message) { return Promise.resolve(message) }
}

module.exports = WSSecureServer
