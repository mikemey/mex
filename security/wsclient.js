const Joi = require('@hapi/joi')

const { LogTrait } = require('../utils')

const configSchema = Joi.object({
  url: Joi.string().uri().required(),
  authToken: Joi.string().min(20).message('"authToken" too short').required()
})

const validateConfig = config => {
  const validation = configSchema.validate(config)
  if (validation.error) {
    throw new Error(validation.error.message)
  }
}

class WSClient extends LogTrait {
  constructor (config) {
    super()
    this.config = config
  }

  start () {
    validateConfig(this.config)
    return Promise.resolve()
  }

  stop () { return Promise.resolve() }
}

module.exports = WSClient
