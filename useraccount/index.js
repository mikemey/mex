const fs = require('fs')
const path = require('path')
const Joi = require('@hapi/joi')

const configSchema = Joi.object({
  httpauth: Joi.object().min(1).message('"httpauth" is required'),
  sessionService: Joi.object({
    url: Joi.string().uri(),
    authToken: Joi.string().min(20).message('"sessionService.authToken" too short')
  })
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

    process.on('SIGTERM', this.stop.bind(this))
    process.on('SIGINT', () => this.stop.bind(this))
  }

  start () {
    validateConfig(this.config)
    return super.start()
  }

  setupApp (app) {
    app.set('views', path.join(__dirname, '/views'))
    app.set('view engine', 'pug')
  }

  addRoutes (router) {
    router.use('/register', registerRouter())
    router.use('/login', loginRouter())
  }
}

module.exports = UserAccountService
