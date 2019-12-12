const symbol = 'btc'

const BitcoinClient = require('bitcoin-core')
const Joi = require('@hapi/joi')

const { Validator, dbconnection } = require('../../utils')

const configSchema = Joi.object({
  client: Joi.object().required(),
  zmq: Joi.string().required(),
  db: Joi.object().required()
})

const create = async config => {
  Validator.oneTimeValidation(configSchema, config)
  await dbconnection.connect(config.db)
  const btcAddressesCollection = dbconnection.collection('btc-addresses')
  const wallet = new BitcoinClient(config.client)

  const createNewAddress = async () => {
    const newAddress = await wallet.getNewAddress()
    await btcAddressesCollection.insertOne({ address: newAddress, blocks: [] })
    return newAddress
  }

  return { createNewAddress }
}

module.exports = { create, symbol }
