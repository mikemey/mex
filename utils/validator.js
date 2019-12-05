const Joi = require('@hapi/joi')

const path = Joi.string().pattern(/^\/[a-zA-Z0-9-]{2,30}$/).message('"path" not valid').required()
const secretToken = name => Joi.string().min(20).message(`"${name}" too short`).base64().required()

const email = ({ message = 'email invalid', warn = false } = {}) => Joi.string()
  .email({ minDomainSegments: 2 })
  .rule({ message, warn })
  .required()
  .error(errors => {
    errors.forEach(err => { err.message = message })
    return errors
  })

const plainPassword = ({ message = 'password invalid' } = {}) => Joi.string()
  .pattern(/^[a-zA-Z0-9!"#$%&'()*+,-./:;[\]<=>?@\\^_`{|}~]{8,50}$/)
  .rule({ message })
  .error(errors => {
    errors.forEach(err => { err.message = message })
    return errors
  })

const hashedPassword = () => Joi.string().hex().length(64).required()

const jwt = () => Joi.string().min(20).required()

const defaultFail = (message, origin) => { throw new Error(message) }

const oneTimeValidation = (schema, data) => {
  const result = schema.validate(data)
  if (result.error) { defaultFail(result.error.message, data) }
  if (result.warning) { defaultFail(result.warning.message, data) }
}

const createCheck = (
  schema, { onError = defaultFail, onWarning = defaultFail } = {}
) => {
  if (!schema) { throw new Error('schema not defined') }
  return data => {
    const result = schema.validate(data)
    if (result.error) { onError(result.error.message, data) }
    if (result.warning) { onWarning(result.warning.message, data) }
  }
}

module.exports = {
  createCheck,
  oneTimeValidation,
  path,
  secretToken,
  email,
  plainPassword,
  hashedPassword,
  jwt
}
