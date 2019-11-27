const fs = require('fs')
const path = require('path')
const Joi = require('@hapi/joi')

const { HttpServer } = require('../security')
const { Validator } = require('../utils')
const { SessionServiceClient } = require('../session')

const registerRouter = require('./register')
const loginRouter = require('./login')

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

    process.on('SIGTERM', this.stop.bind(this))
    process.on('SIGINT', () => this.stop.bind(this))
  }

  start () {
    Validator.oneTimeValidation(configSchema, this.config)
    return super.start()
  }

  stop () {
    return super.stop()
  }

  setupApp (app) {
    app.set('views', path.join(__dirname, '/views'))
    app.set('view engine', 'pug')
  }

  addRoutes (router) {
    router.use('/register', registerRouter(this.sessionClient))
    router.use('/login', loginRouter())
  }
}

module.exports = UserAccountService
