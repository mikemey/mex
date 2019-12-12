const symbol = 'btc'

const BitcoinClient = require('bitcoin-core')
const Joi = require('@hapi/joi')
const NodeCache = require('node-cache')
const zmq = require('zeromq')

const { Validator, dbconnection } = require('../../utils')

const configSchema = Joi.object({
  client: Joi.object().required(),
  zmq: Joi.string().required()
})

const create = (config, invoiceCallback) => {
  Validator.oneTimeValidation(configSchema, config)
  if (!dbconnection.isConnected()) { throw new Error('no db connection available') }

  const btcAddressesCollection = dbconnection.collection('btc-addresses')
  const wallet = new BitcoinClient(config.client)
  const watcher = AddressWatcher(config.zmq, wallet, invoiceCallback)
  watcher.start()

  const createNewAddress = async () => {
    const newAddress = await wallet.getNewAddress()
    console.log('generated new address', newAddress)
    await btcAddressesCollection.insertOne({ address: newAddress, blocks: [] })
    return newAddress
  }

  return { createNewAddress }
}

const AddressWatcher = (zmqUrl, wallet, invoiceCallback) => {
  const sock = new zmq.Subscriber()
  const addresses = new NodeCache({ useClones: false })
  const addAddress = newAddress => {
    addresses.set(newAddress)
  }

  const start = async () => {
    sock.connect(zmqUrl)
    sock.subscribe('hashblock')

    for await (const [rawtopic, rawmsg] of sock) {
      const topic = rawtopic.toString().toUpperCase()
      console.log(` ${topic} >>>>>>>>>>>>>`)

      const blockHash = rawmsg.toString('hex')
      const block = await wallet.getBlockByHash(blockHash)
      // console.log(block.toString('hex'))
      console.log('||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||')
      block.tx.forEach(tx => {
        console.log('invoice-id:', tx.txid)
        tx.vout.forEach(vout => {
          if (vout.scriptPubKey.addresses) {
            vout.scriptPubKey.addresses.forEach(address => {
              console.log(' --> out adddress:', address, ' receives:', vout.value)
            })
          }
        })
      })
      console.log('||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||')
      // console.log(await wallet.getBlockByHash(rawmsg.toString('hex', 0, 80)))
      // invoiceCallback(rawmsg)
    }

    // if (topic === 'HASHTX') {
    //   // txId = rawmsg.toString('hex')
    //   // console.log('record TX-ID:', txId)
    //   // console.log(JSON.stringify(decodedTx, null, '  '))
    // } else if (topic === 'HASHBLOCK') {
    //   console.log('KEPT TX-ID:', txId)
    //   const txInfo = await wallet.getTransaction(txId)
    //   console.log(txInfo)
    //   // console.log(rawmsg.toString('hex'))
    // }
  }
  return { addAddress, start }
}

module.exports = { create, symbol }
