const Joi = require('@hapi/joi')

const path = Joi.string().pattern(/^\/[a-zA-Z0-9-]{2,30}$/).message('"path" not valid').required()
const secretToken = name => Joi.string().min(20).message(`"${name}" too short`).required()

const email = ({ message = 'email invalid', warn = false } = {}) => Joi.string()
  .email({ minDomainSegments: 2 })
  .rule({ message, warn })
  .required()
const password = ({ message = 'password invalid', warn = false } = {}) => Joi.string()
  .pattern(/^[a-zA-Z0-9!"#$%&'()*+,-./:;[\]<=>?@\\^_`{|}~]{8,50}$/)
  .rule({ message, warn })
  .required()
const defaultFail = message => { throw new Error(message) }

const oneTimeValidation = (schema, data) => {
  const result = schema.validate(data)
  if (result.error) { defaultFail(result.error.message) }
  if (result.warning) { defaultFail(result.warning.message) }
}

const createCheck = (
  schema, { onError = defaultFail, onWarning = defaultFail } = {}
) => {
  if (!schema) { throw new Error('schema not defined') }
  return data => {
    const result = schema.validate(data)
    if (result.error) { onError(result.error.message) }
    if (result.warning) { onWarning(result.warning.message) }
  }
}

module.exports = { createCheck, oneTimeValidation, path, secretToken, email, password }
