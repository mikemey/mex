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
      data.sock = new zmq.Subscriber()
      data.sock.connect(config.zmq)
      data.sock.subscribe('hash');
      (async () => {
        for await (const [rawtopic, rawmsg] of data.sock) {
          process(rawtopic, rawmsg)
        }
      })()
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
      logger.debug('new tx:', tx.txid)
      callbackWith(extractInvoices(tx))
    }

    const processBlock = async blockhash => {
      const block = await wallet.getBlockByHash(blockhash)
      data.currentBlockHeight = block.height
      const blockInvoices = block.tx
        .reduce((txInvoices, tx) => txInvoices.concat(extractInvoices(tx)), [])
        .map(invcoice => {
          invcoice.blockheight = block.height
          return invcoice
        })
      logger.info('new block height:', data.currentBlockHeight, 'hash:', blockhash, '# txs:', blockInvoices.length)
      callbackWith(blockInvoices)
    }

    const extractInvoices = tx => tx.vout.reduce((invoices, vout) => {
      if (vout.scriptPubKey.addresses) {
        vout.scriptPubKey.addresses.forEach(address => {
          invoices.push(newInvoice(tx.txid, address, Satoshi.fromBtcValue(vout.value)))
        })
      }
      return invoices
    }, [])

    const callbackWith = invoices => invoicesCallback && invoicesCallback({
      blockheight: data.currentBlockHeight, invoices
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
