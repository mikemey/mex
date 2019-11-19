const mongoose = require('mongoose')
mongoose.Promise = Promise

const connect = (url, name) => {
  const mongooseUrl = `${url}/${name}`
  console.log(`connecting to: [${mongooseUrl}]`)
  return mongoose.connect(mongooseUrl, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true
    // autoIndex: false
  })
}

const close = () => mongoose.connection.close()

module.exports = {
  connect,
  close,
  mongoose
}
