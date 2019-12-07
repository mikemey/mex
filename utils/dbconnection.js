const mg = require('mongoose')
require('mongoose-long')(mg)

const ObjectId = mg.Types.ObjectId
const Long = require('mongodb').Long

let connectionEstablished = false

const connect = ({ url, name }) => {
  if (connectionEstablished) { return Promise.resolve() }
  const dbUrl = `${url}/${name}`
  console.log(`connecting to: [${dbUrl}]`)
  return mg.connect(dbUrl, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
    // autoIndex: false
  }).then(() => { connectionEstablished = true })
}

const close = () => connectionEstablished
  ? mg.connection.close().then(() => { connectionEstablished = false })
  : Promise.resolve()

const collection = name => mg.connection.collection(name)

module.exports = { connect, close, collection, ObjectId, Long, mg }
