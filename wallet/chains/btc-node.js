const symbol = 'btc'

const BitcoinClient = require('bitcoin-core')
const Joi = require('@hapi/joi')
const zmq = require('zeromq')

const { Logger, Validator } = require('../../utils')

const configSchema = Joi.object({
  client: Joi.object().required(),
  zmq: Joi.string().required()
})

const start = (config,
  newTranscationCb = (invoiceId, address, amount) => { },
  newBlockCb = (invoiceId, address, amount) => { }
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
    sock.subscribe('hashtx')
    sock.subscribe('hashblock')

    for await (const [rawtopic, rawmsg] of sock) {
      const topic = rawtopic.toString()
      const hashmsg = rawmsg.toString('hex')
      switch (topic) {
        case 'hashtx': {
          let tx = null
          try {
            tx = await wallet.getTransactionByHash(hashmsg)
          } catch (err) {
            logger.error('CANT FIND:', hashmsg)
            return
          }
          logger.info('received invoice-id:', tx.txid)
          newTranscationCb(tx.txid, tx.vout.reduce((allVouts, vout) => {
            if (vout.scriptPubKey.addresses) {
              vout.scriptPubKey.addresses.forEach(address => {
                allVouts.push({ address, amount: String(vout.value) })
              })
            }
            return allVouts
          }, []))
          break
        }
        // logger.info('||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||')
        // logger.info(JSON.stringify(tx, null, '  '))
        // logger.info('||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||')
        case 'hashblock': {
          // console.log({ rawmsg })
          // console.log({ msg: rawmsg.toString() })
          // console.log({ hexmsg: rawmsg.toString('hex') })

          const block = await wallet.getBlockByHash(hashmsg)
          // // logger.info(block.toString('hex'))
          // logger.info('||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||')
          block.tx.forEach(tx => {
            logger.info('invoice-id:', tx.txid)
            tx.vout.forEach(vout => {
              if (vout.scriptPubKey.addresses) {
                vout.scriptPubKey.addresses.forEach(address => {
                  logger.info(' --> out adddress:', address, ' receives:', vout.value)
                })
              }
            })
          })
          // logger.info('||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||')
          break
        } default: throw new Error(`unexpected topic ${topic}`)
      }
    }
  }

  const stop = () => sock.close()

  listenToZMQ()

  return { createNewAddress, stop }
}

module.exports = { start, symbol }
