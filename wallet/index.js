const BitcoinClient = require('bitcoin-core')
const Joi = require('@hapi/joi')

const { WSSecureServer } = require('../connectors')
const { Validator, wsmessages: { withAction } } = require('../utils')

const configSchema = Joi.object({
  btcClient: Joi.object().min(1).required(),
  db: Joi.object().min(1).required()
}).unknown()

const newAddressMessages = withAction('address')

class WalletService extends WSSecureServer {
  constructor (config) {
    Validator.oneTimeValidation(configSchema, config)
    const configCopy = Object.assign({}, config)
    delete configCopy.btcClient
    delete configCopy.db
    super(configCopy)

    this.btcWallet = new BitcoinClient(config.btcClient)
  }

  async received (request) {
    const address = await this.btcWallet.getNewAddress()
    return newAddressMessages.ok({ address })
  }
}

module.exports = WalletService
