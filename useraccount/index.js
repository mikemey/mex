const bodyParser = require('body-parser')
const fs = require('fs')
const path = require('path')
const querystring = require('querystring')
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

const authenticationCheck = (pathPrefix, errorLog) => {
  const unprotectedPaths = [`${pathPrefix}/login`, `${pathPrefix}/register`, `${pathPrefix}/version`, '/favicon.ico']
  return (req, res, next) => {
    if (unprotectedPaths.includes(req.path)) { return next() }
    if (req.session && req.session.user) { return next() }

    errorLog('authentication required')
    return res.redirect(303, `${pathPrefix}/login?` + querystring.stringify({ authrequired: true }))
  }
}

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
    app.use(authenticationCheck(this.config.httpserver.path, this.log.bind(this)))
    app.use(bodyParser.urlencoded({ extended: true }))
    app.set('views', path.join(__dirname, '/views'))
    app.set('view engine', 'pug')
  }

  addRoutes (router) {
    router.get('/index', (_, res) => res.render('index', { email: 'hello you' }))
    router.use('/', new AccessRouter(this.sessionClient).create())
  }
}

module.exports = UserAccountService
