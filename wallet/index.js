const Joi = require('@hapi/joi')

const { WSSecureServer } = require('../connectors')
const { Validator, dbconnection } = require('../utils')
const { assetsMetadata } = require('../metadata')

const chains = require('./chains')
const Deposits = require('./wallet-deposit')

const INVCOICES_TOPIC = 'invoices'
const BLOCKS_TOPIC = 'blocks'

const configSchema = Joi.object({
  chains: Joi.object().required(),
  db: Joi.object().min(1).required()
}).unknown()

const addressSchema = Joi.object({
  action: Joi.string().valid(Deposits.ADDRESS_ACT, Deposits.INVOICES_ACT).required(),
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

    this.offerTopics(INVCOICES_TOPIC, BLOCKS_TOPIC)
  }

  start () {
    return Promise.all([
      dbconnection.connect(this.dbConfig),
      super.start(),
      chains.createAll(this.chainsConfig),
      Deposits.startListening({
        invoices: event => this.broadcast(INVCOICES_TOPIC, event),
        blocks: event => this.broadcast(BLOCKS_TOPIC, event)
      })
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
      case Deposits.ADDRESS_ACT: return Deposits.getAddress(request)
      case Deposits.INVOICES_ACT: return Deposits.getInvoices(request)
      default: throw new Error(`unexpected action [${request.action}]`)
    }
  }
}

module.exports = WalletService
