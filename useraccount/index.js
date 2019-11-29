const bodyParser = require('body-parser')
const fs = require('fs')
const path = require('path')
const Joi = require('@hapi/joi')

const { HttpServer } = require('../security')
const { Validator } = require('../utils')
const { SessionServiceClient } = require('../session')

const AccessRouter = require('./access-router')

const defconfig = JSON.parse(fs.readFileSync(`${__dirname}/defaults.json`))

const configSchema = Joi.object({
  httpserver: Joi.object().min(1).required(),
  sessionService: Joi.object().min(1).required()
})

class UserAccountService extends HttpServer {
  constructor (config) {
    config.httpserver = Object.assign({}, defconfig.httpserver, config.httpserver)
    config.sessionService = Object.assign({}, defconfig.sessionService, config.sessionService)
    super(config.httpserver)

    this.config = config
    this.server = null
    this.sessionClient = new SessionServiceClient(config.sessionService)
    Validator.oneTimeValidation(configSchema, this.config)
  }

  start () {
    return super.start()
  }

  stop () {
    return this.sessionClient.stop()
      .then(() => super.stop())
  }

  setupApp (app) {
    app.use(bodyParser.urlencoded({ extended: true }))
    app.set('views', path.join(__dirname, '/views'))
    app.set('view engine', 'pug')
  }

  addRoutes (router) {
    router.use('/', new AccessRouter(this.sessionClient).create())
    router.get('/home', (_, res) => res.render('home', { email: 'hello you' }))
  }
}

module.exports = UserAccountService
