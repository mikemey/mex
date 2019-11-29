const Joi = require('@hapi/joi')

const { WSServer } = require('../security')
const model = require('./model')
const SessionServiceClient = require('./session-client')

const { wsmessages, errors: { ClientError }, Validator } = require('../utils')
const sessionAccess = require('./session-access')

const requestSchema = Joi.object({
  action: Joi.string().valid(sessionAccess.KW_REGISTER).required(),
  email: Validator.email({ warn: true }),
  password: Validator.password({ warn: true })
})

const requestCheck = Validator.createCheck(requestSchema, {
  onError: () => { throw new ClientError('invalid request', wsmessages.error('invalid request'), false) },
  onWarning: (msg, origin) => { throw new ClientError(msg, wsmessages.withAction(origin.action).nok(msg)) }
})

class SessionService extends WSServer {
  received (message) {
    requestCheck(message)
    return sessionAccess.register(message)
  }
}

module.exports = { SessionServiceClient, SessionService, model }
