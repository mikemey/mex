const chai = require('chai')
chai.use(require('chai-http'))

const UserAccountService = require('../useraccount')
// const { dbconnection } = require('../utils')

// before(() => dbconnection.connect(dbconfig.url, dbconfig.name)
// after(() => userAccountService.stop().then(() => dbconnection.close()))

const serviceConfig = {
  path: '/test',
  port: 12011
}
const dbconfig = { url: 'mongodb://127.0.0.1:27017', name: 'mex-test' }

const userAccountService = new UserAccountService(serviceConfig)

const start = () => {
  process.env.TESTING = true
  return userAccountService.start()
}

const stop = () => userAccountService.stop()

const agent = () => chai.request.agent(`http://localhost:${serviceConfig.port}${serviceConfig.path}`)

module.exports = { start, stop, agent }
