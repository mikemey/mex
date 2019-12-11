const zmq = require('zeromq')

const { wsmessages: { withAction }, dbconnection } = require('../utils')

const ADDRESS_ACT = 'address'
const newAddressMessages = withAction(ADDRESS_ACT)

const addressesColl = dbconnection.collection('addresses')

const idFilter = id => { return { _id: dbconnection.ObjectId(id) } }

const findUserAddresses = userId => addressesColl.findOne({ _id: dbconnection.ObjectId(userId) })
const createUserAddress = async userId => {
  const newEntry = { _id: dbconnection.ObjectId(userId), reserved: [] }
  await addressesColl.insertOne(newEntry)
  return newEntry
}

const findSymbolAddress = (userAddresses, symbol) => userAddresses.reserved
  .find(symAddress => symAddress.symbol === symbol)
const createSymbolAddress = async (userAddresses, symbol, address) => {
  const newSymbolAddress = { symbol, address }
  userAddresses.reserved.push(newSymbolAddress)
  await addressesColl.updateOne(idFilter(userAddresses._id), {
    $addToSet: { reserved: newSymbolAddress }
  })
  return newSymbolAddress
}

const createDepositer = (wallet, zmqUrl) => {
  const data = { sock: null }

  const getAddress = async request => {
    const { user: { id }, symbol } = request
    const userAddresses = await findUserAddresses(id) || await createUserAddress(id)
    const symbolAddress = findSymbolAddress(userAddresses, symbol) ||
      await createSymbolAddress(userAddresses, symbol, await wallet.getNewAddress())

    return newAddressMessages.ok({ address: symbolAddress.address })
  }

  const startListener = () => {
    const run = async () => {
      data.sock = new zmq.Subscriber()
      data.sock.connect(zmqUrl)
      data.sock.subscribe('hashtx')

      for await (const [topic, msg] of data.sock) {
        console.log('=====', topic.toString(), msg.toString('hex'))
      }
    }
    run()
  }

  const stopListener = () => {
    if (data.sock) { data.sock.close() }
  }

  return { getAddress, startListener, stopListener }
}

module.exports = { createDepositer, ADDRESS_ACT }
