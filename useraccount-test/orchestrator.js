const chai = require('chai')
chai.use(require('chai-http'))
const cheerio = require('cheerio')

const UserAccountService = require('../useraccount')
// const { dbconnection } = require('../utils')

// before(() => dbconnection.connect(dbconfig.url, dbconfig.name)
// after(() => userAccountService.stop().then(() => dbconnection.close()))

const serviceConfig = {
  path: '/test',
  port: 12011
}
// const dbconfig = { url: 'mongodb://127.0.0.1:27017', name: 'mex-test' }

const services = {
  uas: new UserAccountService(serviceConfig)
}

const start = () => services.uas.start()

const stop = () => services.uas.stop()

const agent = () => chai.request.agent(`http://localhost:${serviceConfig.port}${serviceConfig.path}`)

const asHtml = res => cheerio.load(res.text)

module.exports = { start, stop, agent, asHtml }
