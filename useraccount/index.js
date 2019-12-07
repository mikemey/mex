const bodyParser = require('body-parser')
const fs = require('fs')
const path = require('path')
const Joi = require('@hapi/joi')

const { HttpServer } = require('../connectors')
const { dbconnection, Validator } = require('../utils')
const { WSClient } = require('../connectors')

const AccessRouter = require('./access-router')
const BalanceRouter = require('./balance-router')

const defconfig = JSON.parse(fs.readFileSync(`${__dirname}/defaults.json`))

const configSchema = Joi.object({
  httpserver: Joi.object().min(1).required(),
  sessionService: Joi.object().min(1).required(),
  walletService: Joi.object().min(1).required(),
  db: Joi.object().min(1).required()
})

class UserAccountService extends HttpServer {
  constructor (config) {
    Validator.oneTimeValidation(configSchema, config)
    const httpserverConfig = Object.assign({}, defconfig.httpserver, config.httpserver)
    super(httpserverConfig)

    this.dbConfig = config.db
    this.sessionClient = new WSClient(config.sessionService)
    this.walletClient = new WSClient(config.walletService)

    this.accessRouter = new AccessRouter(this.sessionClient, config.httpserver)
    this.balanceRouter = new BalanceRouter()
  }

  start () {
    return Promise.all([dbconnection.connect(this.dbConfig), super.start()])
  }

  stop () {
    return Promise.all([
      this.sessionClient.stop(), this.walletClient.stop(), super.stop(), dbconnection.close()
    ])
  }

  setupApp (app) {
    app.use(this.accessRouter.createAuthenticationCheck())
    app.use(bodyParser.urlencoded({ extended: true }))
    app.set('views', path.join(__dirname, '/views'))
    app.set('view engine', 'pug')
  }

  addRoutes (router) {
    router.get('/index', (_, res) => res.render('index', { email: 'hello you' }))
    router.use('/access', this.accessRouter.createRoutes())
    router.use('/balance', this.balanceRouter.createRoutes())
  }
}

module.exports = UserAccountService
