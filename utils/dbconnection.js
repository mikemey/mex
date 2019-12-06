const mongoose = require('mongoose')

let connectionEstablished = false

const connect = ({ url, name }) => {
  if (connectionEstablished) { return Promise.resolve() }
  const mongooseUrl = `${url}/${name}`
  console.log(`connecting to: [${mongooseUrl}]`)
  return mongoose.connect(mongooseUrl, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
    // autoIndex: false
  }).then(() => { connectionEstablished = true })
}

const close = () => connectionEstablished
  ? mongoose.connection.close().then(() => { connectionEstablished = false })
  : Promise.resolve()

module.exports = { connect, close }
