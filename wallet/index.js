const BitcoinClient = require('bitcoin-core')
const Joi = require('@hapi/joi')

const { WSSecureServer } = require('../connectors')
const { Validator, wsmessages: { withAction } } = require('../utils')

const { assetsMetadata } = require('../metadata')

const configSchema = Joi.object({
  btcClient: Joi.object().min(1).required(),
  db: Joi.object().min(1).required()
}).unknown()

const ADDRESS_ACT = 'address'

const addressSchema = Joi.object({
  action: Joi.string().valid(ADDRESS_ACT).required(),
  jwt: Validator.jwt(),
  symbol: Joi.string().valid(...Object.keys(assetsMetadata)).required()
})
const requestCheck = Validator.createCheck(addressSchema)

const newAddressMessages = withAction(ADDRESS_ACT)

class WalletService extends WSSecureServer {
  constructor (config) {
    Validator.oneTimeValidation(configSchema, config)
    const configCopy = Object.assign({}, config)
    delete configCopy.btcClient
    delete configCopy.db
    super(configCopy)

    this.btcWallet = new BitcoinClient(config.btcClient)
  }

  async secureReceived (request) {
    requestCheck(request)
    const address = await this.btcWallet.getNewAddress()
    return newAddressMessages.ok({ address })
  }
}

module.exports = WalletService
