const fs = require('fs')
const path = require('path')
const Joi = require('@hapi/joi')

const { SessionServiceClient } = require('../session')

const configSchema = Joi.object({
  httpauth: Joi.object().min(1).required(),
  sessionService: Joi.object().min(1).required()
})

const validateConfig = config => {
  const validation = configSchema.validate(config)
  if (validation.error) {
    throw new Error(validation.error.message)
  }
}

const { HTTPAuth } = require('../security')
const defconfig = JSON.parse(fs.readFileSync(`${__dirname}/defaults.json`))

const registerRouter = require('./register')
const loginRouter = require('./login')

class UserAccountService extends HTTPAuth {
  constructor (config) {
    config.httpauth = Object.assign({}, defconfig.httpauth, config.httpauth)
    config.sessionService = Object.assign({}, defconfig.sessionService, config.sessionService)
    super(config.httpauth)
    this.config = config
    this.server = null
    this.sessionClient = new SessionServiceClient(config.sessionService)
    process.on('SIGTERM', this.stop.bind(this))
    process.on('SIGINT', () => this.stop.bind(this))
  }

  start () {
    validateConfig(this.config)
    return this.sessionClient.start()
      .then(() => super.start())
  }

  stop () {
    return this.sessionClient.stop()
      .then(() => super.stop())
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
