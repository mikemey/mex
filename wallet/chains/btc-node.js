const symbol = 'btc'

const BitcoinClient = require('bitcoin-core')
const Joi = require('@hapi/joi')
const zmq = require('zeromq')

const { Logger, Validator } = require('../../utils')

const configSchema = Joi.object({
  client: Joi.object().required(),
  zmq: Joi.string().required()
})

const start = (
  config, newTranscationCb = invoice => { }, newBlockCb = invoices => { }
) => {
  Validator.oneTimeValidation(configSchema, config)

  const logger = Logger('BtcNode')
  const wallet = new BitcoinClient(config.client)
  const sock = new zmq.Subscriber()

  const createNewAddress = async () => {
    const newAddress = await wallet.getNewAddress()
    logger.info('generated new address', newAddress)
    return newAddress
  }

  const listenToZMQ = async () => {
    sock.connect(config.zmq)
    sock.subscribe('hash')

    for await (const [rawtopic, rawmsg] of sock) { process(rawtopic, rawmsg) }
  }

  const process = async (rawtopic, rawmsg) => {
    const topic = rawtopic.toString()
    const hashmsg = rawmsg.toString('hex')
    if (topic === 'hashtx') { return processTransaction(hashmsg) }
    if (topic === 'hashblock') { return processBlock(hashmsg) }
    logger.error('ignoring topic', topic)
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
    newTranscationCb(extractInvoices(tx))
  }

  const processBlock = async blockhash => {
    const block = await wallet.getBlockByHash(blockhash)
    logger.info('new block:', block.hash)
    const confirmedInvoices = block.tx
      .reduce((txInvoices, tx) => txInvoices.concat(extractInvoices(tx)), [])
      .map(invcoice => {
        invcoice.block = block.height
        return invcoice
      })
    newBlockCb(confirmedInvoices)
  }

  const extractInvoices = tx => tx.vout.reduce((invoices, vout) => {
    if (vout.scriptPubKey.addresses) {
      vout.scriptPubKey.addresses.forEach(address => {
        invoices.push(
          { invoiceId: tx.txid, address, amount: String(vout.value) }
        )
      })
    }
    return invoices
  }, [])

  const stop = () => sock.close()

  listenToZMQ()

  return { createNewAddress, stop }
}

module.exports = { start, symbol }
