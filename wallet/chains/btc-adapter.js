const symbol = 'btc'

const BitcoinClient = require('bitcoin-core')
const Joi = require('@hapi/joi')
const zmq = require('zeromq')

const { Logger, Validator, units: { Satoshi } } = require('../../utils')

const configSchema = Joi.object({
  client: Joi.object().required(),
  zmq: Joi.string().required()
})

const newInvoice = (invoiceId, address, amount, blockheight = null) => {
  return { invoiceId, address, amount, blockheight }
}

const create = config => {
  Validator.oneTimeValidation(configSchema, config)
  const logger = Logger('btc adapter')
  const wallet = new BitcoinClient(config.client)
  let sock

  const createNewAddress = async () => {
    const newAddress = await wallet.getNewAddress()
    logger.info('generated new btc address', newAddress)
    return newAddress
  }

  const startListener = invoicesCallback => {
    const listenToZMQ = async () => {
      sock = new zmq.Subscriber()
      sock.connect(config.zmq)
      sock.subscribe('hash')
      for await (const [rawtopic, rawmsg] of sock) { process(rawtopic, rawmsg) }
    }

    const process = async (rawtopic, rawmsg) => {
      const topic = rawtopic.toString()
      const hashmsg = rawmsg.toString('hex')

      switch (topic) {
        case 'hashtx': return processTransaction(hashmsg)
        case 'hashblock': return processBlock(hashmsg)
        default: {
          logger.error('ignoring topic', topic)
        }
      }
    }

    const processTransaction = async txhash => {
      let tx = null
      try {
        tx = await wallet.getTransactionByHash(txhash)
      } catch (err) {
        if (err.message === `${txhash} not found`) { return /* ignore non-mempool TXs */ }
        logger.error(err.message)
        return
      }
      logger.info('new tx:', tx.txid)
      invoicesCallback(extractInvoices(tx))
    }

    const processBlock = async blockhash => {
      const block = await wallet.getBlockByHash(blockhash)
      const blockInvoices = block.tx
        .reduce((txInvoices, tx) => txInvoices.concat(extractInvoices(tx)), [])
        .map(invcoice => {
          invcoice.blockheight = block.height
          return invcoice
        })
      logger.info('new block height:', block.height, 'hash:', blockhash)
      invoicesCallback(blockInvoices)
    }

    const extractInvoices = tx => tx.vout.reduce((invoices, vout) => {
      if (vout.scriptPubKey.addresses) {
        vout.scriptPubKey.addresses.forEach(address => {
          invoices.push(newInvoice(tx.txid, address, Satoshi.fromBtcValue(vout.value)))
        })
      }
      return invoices
    }, [])

    listenToZMQ()
  }

  const stopListener = () => sock && sock.close()

  return { startListener, stopListener, createNewAddress }
}

module.exports = { create, symbol }
