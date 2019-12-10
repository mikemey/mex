const BitcoinClient = require('bitcoin-core')
const Joi = require('@hapi/joi')

const { WSSecureServer } = require('../connectors')
const { Validator, dbconnection } = require('../utils')

const { assetsMetadata } = require('../metadata')

const { createDepositer, ADDRESS_ACT } = require('./wallet-deposit')

const configSchema = Joi.object({
  btcClient: Joi.object().min(1).required(),
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
    delete configCopy.btcClient
    delete configCopy.db
    super(configCopy)

    this.dbConfig = config.db

    const btcWallet = new BitcoinClient(config.btcClient)
    this.depositer = createDepositer(btcWallet)
  }

  start () {
    return Promise.all([dbconnection.connect(this.dbConfig), super.start()])
  }

  stop () {
    return Promise.all([super.stop(), dbconnection.close()])
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
