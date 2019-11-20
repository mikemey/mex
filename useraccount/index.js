const bodyParser = require('body-parser')
const express = require('express')
const moment = require('moment')
const morgan = require('morgan')

const settings = require('./settings.json')
const { LogTrait } = require('../utils')

const suppressRequestLog = [
  '/version'
]

const requestLogger = pathPrefix => {
  morgan.token('clientIP', req => req.headers['x-forwarded-for'] || req.connection.remoteAddress)
  const format = ':date[iso] [:clientIP] :method :url [:status] [:res[content-length] bytes] - :response-time[0]ms :user-agent'

  const suppressList = suppressRequestLog.map(entry => `${pathPrefix}${entry}`)
  const skip = (req, res) =>
    suppressList.includes(req.originalUrl) ||
    process.env.TESTING !== undefined ||
    res.statusCode === 304

  return morgan(format, { skip })
}

const createServer = config => {
  const app = express()

  app.use(bodyParser.json())
  app.use(requestLogger(config.path))

  const pathRouter = express.Router()
  app.use(config.path, pathRouter)

  pathRouter.get('/version', (_, res) => res.status(200).send(config.version))
  return app
}

class UserAccountService extends LogTrait {
  constructor (config) {
    super()
    this.server = null
    this.config = config
  }

  start () {
    if (this.server) { throw new Error('server already started') }

    return new Promise((resolve, reject) => {
      const now = moment.utc().toISOString()
      this.config.version = `${settings.version} (${now})`
      const server = createServer(this.config)
        .listen(this.config.port, this.config.interface, () => {
          this.log(`started on port ${server.address().port}`)
          this.log(`server version: ${this.config.version}`)
          resolve(server)
        })

      server.once('error', err => {
        this.errorLog(`server error: ${err.message}`)
        this.errorLog(err)
        reject(err)
      })
    }).then(server => {
      this.server = server
    })
  }

  stop () {
    if (!this.server) { throw new Error('no server instance available') }

    return new Promise((resolve, reject) => {
      this.server.close(resolve)
    })
  }
}

module.exports = UserAccountService
