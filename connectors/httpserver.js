const cookieSession = require('cookie-session')
const Tokens = require('csrf')
const express = require('express')
const moment = require('moment')
const morgan = require('morgan')
const Joi = require('@hapi/joi')

const { Logger, LOG_LEVELS, Validator } = require('../utils')

const SESSION_COOKIE_NAME = 'x-session'

const configSchema = Joi.object({
  secret: Validator.secretToken('secret'),
  version: Joi.string().required(),
  interface: Joi.string().ip().message('"interface" not valid').required(),
  port: Joi.number().port().required(),
  path: Validator.path,
  suppressRequestLog: Joi.array().items(Validator.path.optional()).required()
})

const sessionStore = secret => cookieSession({
  name: SESSION_COOKIE_NAME,
  secret,
  path: '/',
  httpOnly: true,
  signed: true,
  maxAge: 2 * 60 * 60 * 1000
})

const csrfProtection = logger => {
  const tokens = new Tokens({})
  const secret = tokens.secretSync()
  const skipMethods = ['GET', 'HEAD', 'OPTIONS']
  return (req, res, next) => {
    if (!skipMethods.includes(req.method)) {
      const recvToken = req.session.csrf
      if (!tokens.verify(secret, recvToken)) {
        logger.error('csrf token verification failed')
        return res.status(403).end()
      }
    }
    const csrfToken = tokens.create(secret)
    req.session.csrf = csrfToken
    next()
  }
}

const requestLogger = (suppressList, logger) => {
  morgan.token('clientIP', req => req.headers['x-forwarded-for'] || req.connection.remoteAddress)
  morgan.token('redirectUrl', (_, res) => res.statusCode >= 300 && res.statusCode < 400
    ? ` --> ${res.getHeader('location')}]`
    : ']'
  )
  const format = ':date[iso]  http [:clientIP] :method :url [:status:redirectUrl [:res[content-length] bytes] - :response-time[0]ms :user-agent'

  const skip = req => suppressList.includes(req.originalUrl) || logger.skipLogLevel(LOG_LEVELS.http)

  return morgan(format, { skip })
}

const errorLogger = logger => (err, req, res, next) => {
  logger.error('ERROR:', err.message, err)
  res.status(500).end()
}

const createVersionEndpoint = version => {
  const response = `${version} (${moment.utc().toISOString()})`
  return (_, res) => res.send(response)
}

class HttpServer {
  constructor (httpconfig) {
    this.server = null
    this.httpconfig = httpconfig
    this.connections = {}
    Validator.oneTimeValidation(configSchema, this.httpconfig)
    this.logger = Logger(this.constructor.name)
  }

  setupApp (_) { }
  addRoutes (_) { throw new Error('missing addRoutes() implementation') }

  start () {
    if (this.server !== null) { throw new Error('server already started') }
    this.connections = {}

    return new Promise((resolve, reject) => {
      const server = this._createServer().listen(this.httpconfig.port, this.httpconfig.interface, () => {
        this.logger.info('started on port', server.address().port)
        this.logger.info('server version:', this.httpconfig.version)
        this._addConnectionListeners(server)
        this.server = server
        resolve(server)
      })

      server.once('error', err => {
        this.logger.error('server error:', err.message, err)
        reject(err)
      })
    })
  }

  _createServer () {
    const app = express()

    const suppressList = this.httpconfig.suppressRequestLog.map(entry => `${this.httpconfig.path}${entry}`)
    app.use(requestLogger(suppressList, this.logger))
    app.use(sessionStore(this.httpconfig.secret))
    app.use(csrfProtection(this.logger))
    this.setupApp(app)

    const pathRouter = express.Router()
    app.use(this.httpconfig.path, pathRouter)

    pathRouter.get('/version', createVersionEndpoint(this.httpconfig.version))
    this.addRoutes(pathRouter)

    app.use(errorLogger(this.logger))
    return app
  }

  _addConnectionListeners (server) {
    server.on('connection', conn => {
      var key = `${conn.remoteAddress}:${conn.remotePort}`
      this.connections[key] = conn
      conn.on('close', () => delete this.connections[key])
    })
  }

  stop () {
    if (this.server === null) { return Promise.resolve() }
    return new Promise(resolve => {
      this.logger.debug('shutting down...')

      this.server.close(() => {
        this.server = null
        this.logger.info('server closed')
        resolve()
      })

      for (const address in this.connections) {
        this.connections[address].destroy()
      }
    })
  }
}

module.exports = HttpServer
