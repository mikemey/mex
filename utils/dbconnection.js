const mg = require('mongoose')
require('mongoose-long')(mg)

const ObjectId = mg.Types.ObjectId

const logger = require('./logger').Logger('dbconnection')

let connectionEstablished = false

const connect = ({ url, name }) => {
  if (connectionEstablished) { return Promise.resolve() }
  const dbUrl = `${url}/${name}`
  logger.info(`connecting to: [${dbUrl}]`)
  return mg.connect(dbUrl, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
    // autoIndex: false
  }).then(() => { connectionEstablished = true })
}

const isConnected = () => mg.connection.db !== undefined &&
  mg.connection.db.serverConfig.isConnected()

const close = () => connectionEstablished
  ? mg.connection.close().then(() => { connectionEstablished = false })
  : Promise.resolve()

const collection = name => mg.connection.collection(name)

module.exports = { isConnected, connect, close, collection, ObjectId }
