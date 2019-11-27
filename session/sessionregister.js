const Joi = require('@hapi/joi')

const { WSServer } = require('../security')
const { errors, wsmessages, Validator } = require('../utils')
const ClientError = errors.ClientError
const { Credentials } = require('./model')

const isUserExists = err => err.name === 'UserExistsError'

const REGISTER = 'register'
const responses = wsmessages.withAction(REGISTER)

const requestSchema = Joi.object({
  action: Joi.string().valid(REGISTER).required(),
  email: Validator.email({ warn: true }),
  password: Validator.password({ warn: true })
})

class SessionRegisterService extends WSServer {
  constructor (wssconfig) {
    super(wssconfig)
    this.users = []
    this.requestCheck = Validator.createCheck(requestSchema, {
      onError: () => { throw new ClientError('invalid request', wsmessages.error('invalid request'), false) },
      onWarning: message => { throw new ClientError(message, responses.nok(message)) }
    })
  }

  received (message) {
    this.requestCheck(message)
    return Credentials.register({ email: message.email }, message.password)
      .then(() => {
        return responses.ok()
      })
      .catch(err => {
        if (isUserExists(err)) { return responses.nok(`duplicate name [${message.email}]`) }
        throw err
      })
  }
}

module.exports = SessionRegisterService
