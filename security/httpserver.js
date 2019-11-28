const cookieSession = require('cookie-session')
const Tokens = require('csrf')
const express = require('express')
const moment = require('moment')
const morgan = require('morgan')
const Joi = require('@hapi/joi')

const { LogTrait, Validator } = require('../utils')

const SESSION_COOKIE_NAME = 'x-session'

const configSchema = Joi.object({
  secret: Validator.secretToken('secret'),
  version: Joi.string().required(),
  interface: Joi.string().ip().message('"interface" not valid').required(),
  port: Joi.number().port().required(),
  path: Validator.path,
  suppressRequestLog: Joi.array().items(Validator.path.optional()).required()
})

const sessionStore = config => cookieSession({
  name: SESSION_COOKIE_NAME,
  secret: config.secret,
  path: config.path,
  httpOnly: true,
  signed: true,
  maxAge: 2 * 60 * 60 * 1000
})

const csrfProtection = errorLog => {
  const tokens = new Tokens({})
  const secret = tokens.secretSync()
  const skipMethods = ['GET', 'HEAD', 'OPTIONS']
  return (req, res, next) => {
    if (!skipMethods.includes(req.method)) {
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

const errorLogger = errorFunc => (err, req, res, next) => {
  errorFunc('ERROR:', err.message, err)
  res.status(500).end()
}

const createVersionEndpoint = version => {
  const response = `${version} (${moment.utc().toISOString()})`
  return (_, res) => res.send(response)
}

class HttpServer extends LogTrait {
  constructor (httpconfig) {
    super()
    this.server = null
    this.httpconfig = httpconfig
  }

  setupApp (_) { }
  addRoutes (_) { throw new Error('missing addRoutes() implementation') }

  start () {
    if (this.server) { throw new Error('server already started') }
    Validator.oneTimeValidation(configSchema, this.httpconfig)

    return new Promise((resolve, reject) => {
      const server = this.createServer().listen(this.httpconfig.port, this.httpconfig.interface, () => {
        this.log('started on port', server.address().port)
        this.log('server version:', this.httpconfig.version)
        this.server = server
        resolve(server)
      })

      server.once('error', err => {
        this.log('server error:', err.message, err)
        reject(err)
      })
    })
  }

  createServer () {
    const errorFunc = this.log.bind(this)
    const app = express()

    const suppressList = this.httpconfig.suppressRequestLog.map(entry => `${this.httpconfig.path}${entry}`)
    app.use(requestLogger(suppressList))
    this.setupApp(app)

    app.use(sessionStore(this.httpconfig))
    app.use(csrfProtection(errorFunc))

    const pathRouter = express.Router()
    app.use(this.httpconfig.path, pathRouter)

    pathRouter.get('/version', createVersionEndpoint(this.httpconfig.version))
    this.addRoutes(pathRouter)

    app.use(errorLogger(errorFunc))
    return app
  }

  stop () {
    if (!this.server) { return Promise.resolve() }
    return new Promise(resolve => {
      this.log('shutting down...')
      this.server.close(() => {
        this.log('server closed')
        resolve()
      })
      this.server = null
    })
  }
}

module.exports = HttpServer
