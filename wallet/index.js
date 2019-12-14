const Joi = require('@hapi/joi')

const { WSSecureServer } = require('../connectors')
const { Validator, dbconnection } = require('../utils')
const { assetsMetadata } = require('../metadata')

const chains = require('./chains')
const { createDepositer, ADDRESS_ACT } = require('./wallet-deposit')

const configSchema = Joi.object({
  chains: Joi.object().required(),
  db: Joi.object().min(1).required()
}).unknown()

const addressSchema = Joi.object({
  action: Joi.string().valid(ADDRESS_ACT).required(),
  user: Joi.object().required(),
  symbol: Joi.string().valid(...Object.keys(assetsMetadata)).required()
})
const requestCheck = Validator.createCheck(addressSchema)

class WalletService extends WSSecureServer {
  constructor (config) {
    Validator.oneTimeValidation(configSchema, config)
    const configCopy = Object.assign({}, config)
    delete configCopy.chains
    delete configCopy.db
    super(configCopy)

    this.dbConfig = config.db
    this.chainsConfig = config.chains

    this.depositer = createDepositer()
    this.offerTopics('address-funding')
  }

  start () {
    return Promise.all([
      dbconnection.connect(this.dbConfig), super.start(), chains.createAll(this.chainsConfig)
    ])
  }

  stop () {
    return Promise.all([
      super.stop(), dbconnection.close(), chains.stopAll()
    ])
  }

  async secureReceived (request) {
    requestCheck(request)
    switch (request.action) {
      case ADDRESS_ACT: return this.depositer.getAddress(request)
      default: throw new Error(`unexpected action [${require.action}]`)
    }
  }
}

module.exports = WalletService
