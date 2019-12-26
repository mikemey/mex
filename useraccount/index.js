const bodyParser = require('body-parser')
const express = require('express')
const expressWs = require('express-ws')
const fs = require('fs')
const path = require('path')
const Joi = require('@hapi/joi')

const { HttpServer } = require('../connectors')
const { dbconnection, Validator } = require('../utils')
const { WSClient } = require('../connectors')

const AccessRouter = require('./access-router')
const BalanceRouter = require('./balance-router')
const BalanceService = require('./balance-service')

const defconfig = JSON.parse(fs.readFileSync(`${__dirname}/defaults.json`))

const configSchema = Joi.object({
  httpserver: Joi.object().min(1).required(),
  sessionService: Joi.object().min(1).required(),
  walletService: Joi.object().min(1).required(),
  db: Joi.object().min(1).required(),
  clientTimeout: Joi.number().min(10).max(100000).required()
})

class UserAccountService extends HttpServer {
  constructor (config) {
    Validator.oneTimeValidation(configSchema, config)
    const httpserverConfig = Object.assign({}, defconfig.httpserver, config.httpserver)
    super(httpserverConfig)

    this.dbConfig = config.db
    this.basepath = config.httpserver.path
    this.sessionClient = new WSClient(config.sessionService, 'UserAccount SessionClient')
    this.walletClient = new WSClient(config.walletService, 'UserAccount WalletClient')

    this.accessRouter = new AccessRouter(this.sessionClient, config.httpserver)
    this.balanceService = BalanceService(this.walletClient)
    this.balanceRouter = new BalanceRouter(this.balanceService, config)
  }

  start () {
    return Promise.all([
      dbconnection.connect(this.dbConfig),
      this.balanceService.start(),
      super.start()
    ]).catch(err => { this.logger.debug('start error:', err.message) })
  }

  stop () {
    return Promise.all([
      this.balanceRouter.stop(),
      this.balanceService.stop(),
      this.sessionClient.stop(),
      this.walletClient.stop(),
      super.stop(),
      dbconnection.close()
    ]).catch(err => { this.logger.debug('stop error:', err.message) })
  }

  setupApp (app) {
    expressWs(app)
    app.use(this.accessRouter.createAuthenticationCheck())
    app.use(bodyParser.urlencoded({ extended: true }))
    app.set('views', path.join(__dirname, '/views'))
    app.set('view engine', 'pug')

    app.use(`${this.basepath}/public`, express.static(path.join(__dirname, 'public')))
    app.locals.basepath = this.basepath
  }

  addRoutes (router) {
    router.get('/index', (req, res) => res.render('index', { email: req.user.email }))
    router.use('/', this.accessRouter.createRoutes())
    router.use('/', this.balanceRouter.createRoutes())
  }
}

module.exports = UserAccountService
