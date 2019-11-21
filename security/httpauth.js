const bodyParser = require('body-parser')
const cookieSession = require('cookie-session')
const Tokens = require('csrf')
const express = require('express')
const moment = require('moment')
const morgan = require('morgan')
const Joi = require('@hapi/joi')

const { LogTrait } = require('../utils')

const SESSION_COOKIE_NAME = 'x-session'

const configSchema = Joi.object({
  version: Joi.string().required(),
  interface: Joi.string().ip()
    .rule({ message: '"interface" not valid' }).required(),
  port: Joi.number().port().required(),
  path: Joi.string().pattern(/^\/[a-zA-Z0-9-]{2,30}$/)
    .rule({ message: '"path" not valid' }).required(),
  suppressRequestLog: Joi.array().items(Joi.string()).required()
})

const validateConfig = config => {
  const validation = configSchema.validate(config)
  if (validation.error) {
    throw new Error(validation.error.message)
  }
}

const sessionStore = config => cookieSession({
  name: SESSION_COOKIE_NAME,
  secret: 'sdafkjq3rajp;kc;',
  path: config.path,
  httpOnly: true,
  signed: true,
  maxAge: 2 * 60 * 60 * 1000
})

const csrfProtection = errorLog => {
  const tokens = new Tokens({})
  const secret = tokens.secretSync()
  return (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const recvToken = req.session.csrf
      if (!tokens.verify(secret, recvToken)) {
        errorLog('csrf token verification failed')
        return res.status(403).end()
      }
    }
    const csrfToken = tokens.create(secret)
    req.session.csrf = csrfToken
    next()
  }
}

const requestLogger = suppressList => {
  morgan.token('clientIP', req => req.headers['x-forwarded-for'] || req.connection.remoteAddress)
  const format = ':date[iso] [:clientIP] :method :url [:status] [:res[content-length] bytes] - :response-time[0]ms :user-agent'

  const skip = (req, res) =>
    suppressList.includes(req.originalUrl) ||
    process.env.TESTING !== undefined ||
    res.statusCode === 304

  return morgan(format, { skip })
}

const addIfAvailable = (routing, path, router) => {
  if (router) { routing(path, router) }
}

const createVersionEndpoint = version => {
  const response = `${version} (${moment.utc().toISOString()})`
  return (_, res) => res.send(response)
}

class HttpAuth extends LogTrait {
  constructor (config) {
    super()
    this.server = null
    this.config = config
  }

  getRouter () { throw new Error('missing getRouter() implementation') }

  start () {
    if (this.server) { throw new Error('server already started') }
    validateConfig(this.config)

    return new Promise((resolve, reject) => {
      const server = this.createServer().listen(this.config.port, this.config.interface, () => {
        this.log(`started on port ${server.address().port}`)
        this.log(`server version: ${this.config.version}`)
        this.server = server
        resolve(server)
      })

      server.once('error', err => {
        this.errorLog(`server error: ${err.message}`)
        this.errorLog(err)
        reject(err)
      })
    })
  }

  createServer () {
    const errorFunc = this.errorLog.bind(this)
    const app = express()
    app.use(bodyParser.json())

    const suppressList = this.config.suppressRequestLog.map(entry => `${this.config.path}${entry}`)
    app.use(requestLogger(suppressList))
    app.set('views', './views')
    app.set('view engine', 'pug')

    app.use(sessionStore(this.config))
    app.use(csrfProtection(errorFunc))

    const pathRouter = express.Router()
    app.use(this.config.path, pathRouter)

    addIfAvailable(pathRouter.get.bind(pathRouter), '/version', createVersionEndpoint(this.config.version))
    addIfAvailable(pathRouter.use.bind(pathRouter), '/', this.getRouter())

    app.use((err, req, res, next) => {
      this.errorLog(`ERROR: ${err.message}`, err)
      res.status(500).end()
    })
    return app
  }

  stop () {
    if (!this.server) { throw new Error('no server instance available') }

    return new Promise((resolve, reject) => {
      this.log('shutting down...')
      this.server.close(() => {
        this.log('server closed')
        resolve()
      })
      this.server = null
    })
  }
}

module.exports = HttpAuth
