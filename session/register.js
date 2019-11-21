const Joi = require('@hapi/joi')

const { WSAuth } = require('../security')
const { errors, wsmessages } = require('../utils')
const ClientError = errors.ClientError
const { Credentials } = require('./model')

const isUserExists = err => err.name === 'UserExistsError'

const ACT_REGISTER = 'register'
const responses = wsmessages.withAction(ACT_REGISTER)

const requestSchema = Joi.object({
  action: Joi.string().valid(ACT_REGISTER).required(),
  email: Joi.string()
    .email({ minDomainSegments: 2 })
    .rule({ message: 'email invalid', warn: true })
    .required(),
  password: Joi.string()
    .pattern(/^[a-zA-Z0-9]{8,30}$/)
    .rule({ message: 'password invalid', warn: true })
    .required()
})

const validateMessage = msg => {
  const result = requestSchema.validate(msg)
  if (result.error) {
    throw new ClientError('invalid request', wsmessages.error('invalid request'))
  }
  if (result.warning) {
    throw new ClientError(result.warning.message, responses.nok(result.warning.message), false)
  }
}

class RegisterService extends WSAuth {
  constructor (wssconfig) {
    super(wssconfig)
    this.users = []
  }

  received (message) {
    validateMessage(message)
    return Credentials.register({ email: message.email }, message.password)
      .then(() => responses.ok())
      .catch(err => {
        if (isUserExists(err)) { return responses.nok(`duplicate name [${message.email}]`) }
        throw err
      })
  }
}

module.exports = RegisterService