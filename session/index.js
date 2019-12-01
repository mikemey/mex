const Joi = require('@hapi/joi')

const { WSServer } = require('../connectors')
const model = require('./model')
const SessionServiceClient = require('./session-client')

const { dbconnection, wsmessages, errors: { ClientError }, Validator } = require('../utils')
const { createAccessService, KW_LOGIN, KW_REGISTER } = require('./session-access')

const configSchema = Joi.object({
  jwtkey: Validator.secretToken('jwtkey'),
  wsserver: Joi.object().required(),
  db: Joi.object({
    url: Joi.string().required(),
    name: Joi.string().required()
  }).required()
})

const requestSchema = Joi.object({
  action: Joi.string().valid(KW_REGISTER, KW_LOGIN).required(),
  email: Validator.email({ warn: true }),
  password: Validator.password({ warn: true })
})

const requestCheck = Validator.createCheck(requestSchema, {
  onError: () => { throw new ClientError('invalid request', wsmessages.error('invalid request'), false) },
  onWarning: (msg, origin) => { throw new ClientError(msg, wsmessages.withAction(origin.action).nok(msg)) }
})

class SessionService extends WSServer {
  constructor (config) {
    super(config.wsserver)
    Validator.oneTimeValidation(configSchema, config)
    this.dbConfig = config.db
    this.accessService = createAccessService(Buffer.from(config.jwtkey, 'base64'), { expiresIn: '2h' })
  }

  start () {
    return dbconnection.connect(this.dbConfig)
      .then(() => super.start())
  }

  stop () {
    return super.stop().then(dbconnection.close)
  }

  received (message) {
    requestCheck(message)
    switch (message.action) {
      case KW_LOGIN: return this.accessService.loginUser(message, this.secretBuffer)
      case KW_REGISTER: return this.accessService.registerUser(message)
      default: throw new Error(`unexpected action ${message.action}`)
    }
  }
}

module.exports = { SessionServiceClient, SessionService, model }
