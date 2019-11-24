const Joi = require('@hapi/joi')

const { WSAuth } = require('../security')
const { errors, wsmessages, Validator } = require('../utils')
const ClientError = errors.ClientError
const { Credentials } = require('./model')

const isUserExists = err => err.name === 'UserExistsError'

const ACT_REGISTER = 'register'
const responses = wsmessages.withAction(ACT_REGISTER)

const requestSchema = Joi.object({
  action: Joi.string().valid(ACT_REGISTER).required(),
  email: Validator.email({ warn: true }),
  password: Validator.password({ warn: true })
})

class RegisterService extends WSAuth {
  constructor (wssconfig) {
    super(wssconfig)
    this.users = []
    this.requestCheck = Validator.createCheck(requestSchema, {
      onError: () => { throw new ClientError('invalid request', wsmessages.error('invalid request')) },
      onWarning: message => { throw new ClientError(message, responses.nok(message), false) }
    })
  }

  received (message) {
    this.requestCheck(message)
    return Credentials.register({ email: message.email }, message.password)
      .then(() => responses.ok())
      .catch(err => {
        if (isUserExists(err)) { return responses.nok(`duplicate name [${message.email}]`) }
        throw err
      })
  }
}

module.exports = RegisterService
