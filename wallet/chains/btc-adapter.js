const symbol = 'btc'

const BitcoinClient = require('bitcoin-core')
const Joi = require('@hapi/joi')
const zmq = require('zeromq')

const { Logger, Validator, units: { fromAmount } } = require('../../utils')

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
  const data = {
    sock: null,
    currentBlockHeight: null
  }

  const createNewAddress = async () => {
    const newAddress = await wallet.getNewAddress()
    logger.info('generated new btc address', newAddress)
    return newAddress
  }

  const startListener = invoicesCallback => {
    const listenToZMQ = async () => {
      data.currentBlockHeight = (await wallet.getBlockchainInformation()).blocks

      logger.debug('connect zmq socket...')
      data.sock = zmq.socket('sub')
      data.sock.connect(config.zmq)
      data.sock.subscribe('hash')
      data.sock.on('message', (topic, message) => {
        process(topic, message)
      })
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
      logger.debug('incoming tx:', txhash)
      try {
        tx = await wallet.getTransactionByHash(txhash)
      } catch (err) {
        if (err.message === `${txhash} not found`) { return /* ignore unrelated TXs */ }
        logger.error('getTransactionByHash error:', err.message)
        return
      }
      logger.debug('new tx:', tx.txid)
      sendInvoiceUpdate(extractInvoices(tx))
    }

    const processBlock = async blockhash => {
      logger.debug('incoming block:', blockhash)
      let block
      try {
        block = await wallet.getBlockByHash(blockhash)
      } catch (err) {
        logger.error('getBlockByHash error:', err.message)
        return
      }
      sendBlockUpdate(block.height)
      data.currentBlockHeight = block.height

      const blockInvoices = block.tx
        .reduce((txInvoices, tx) => txInvoices.concat(extractInvoices(tx)), [])
        .map(invoice => {
          invoice.blockheight = block.height
          return invoice
        })
      logger.info('new block height:', data.currentBlockHeight, 'hash:', blockhash, '# txs:', blockInvoices.length)
      sendInvoiceUpdate(blockInvoices)
    }

    const extractInvoices = tx => tx.vout.reduce((invoices, vout) => {
      if (vout.scriptPubKey.addresses) {
        vout.scriptPubKey.addresses.forEach(address => {
          invoices.push(newInvoice(tx.txid, address, fromAmount(vout.value, 'btc').toBaseUnit()))
        })
      }
      return invoices
    }, [])

    const sendInvoiceUpdate = invoices => invoicesCallback && invoicesCallback({
      type: 'invoices', blockheight: data.currentBlockHeight, invoices
    })

    const sendBlockUpdate = blockheight => invoicesCallback && invoicesCallback({
      type: 'block', symbol, blockheight
    })

    return listenToZMQ()
  }

  const stopListener = () => {
    if (data.sock !== null) {
      logger.debug('closing zmq socket')
      data.sock.close()
      data.sock = null
    }
  }

  return { startListener, stopListener, createNewAddress }
}

module.exports = { create, symbol }
