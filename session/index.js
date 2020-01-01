const Joi = require('@hapi/joi')

const { WSServer } = require('../connectors')

const { dbconnection, wsmessages, errors: { ClientError }, Validator } = require('../utils')
const { createAccessService, KW_LOGIN, KW_REGISTER, KW_VERIFY, KW_REVOKE } = require('./session-access')

const configSchema = Joi.object({
  jwtkey: Validator.secretToken('jwtkey'),
  wsserver: Joi.object().required(),
  db: Joi.object({
    url: Joi.string().required(),
    name: Joi.string().required()
  }).required()
})

const loginRegisterSchema = Joi.object({
  action: Joi.string().valid(KW_REGISTER, KW_LOGIN).required(),
  email: Validator.email({ warn: true }),
  password: Validator.hashedPassword()
})

const verifySchema = Joi.object({
  action: Joi.string().valid(KW_VERIFY, KW_REVOKE).required(),
  jwt: Validator.jwt()
})

const fullSchema = Joi.alternatives().try(verifySchema, loginRegisterSchema)

const requestCheck = Validator.createCheck(fullSchema, {
  onError: () => { throw new ClientError('invalid request', wsmessages.error('invalid request'), false) },
  onWarning: (msg, origin) => { throw new ClientError(msg, wsmessages.withAction(origin.action).nok(msg)) }
})

const jwtExpirationSecs = 2 * 60 * 60

class SessionService extends WSServer {
  constructor (config) {
    super(config.wsserver)
    Validator.oneTimeValidation(configSchema, config)
    this.dbConfig = config.db

    const secretBuffer = Buffer.from(config.jwtkey, 'base64')
    this.accessService = createAccessService(secretBuffer, jwtExpirationSecs)
  }

  start () {
    return dbconnection.connect(this.dbConfig)
      .then(() => super.start())
  }

  stop () {
    super.stop()
    return dbconnection.close()
  }

  received (message) {
    requestCheck(message)
    switch (message.action) {
      case KW_LOGIN: return this.accessService.loginUser(message)
      case KW_REGISTER: return this.accessService.registerUser(message)
      case KW_VERIFY: return this.accessService.verifyToken(message)
      case KW_REVOKE: return this.accessService.revokeToken(message)
      default: throw new Error(`unexpected action ${message.action}`)
    }
  }
}

module.exports = SessionService
