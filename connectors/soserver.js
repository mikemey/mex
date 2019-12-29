const { Router } = require('zeromq')

const Joi = require('@hapi/joi')

const { Logger, Validator, messages: { error, parseMessageBody, createMessageBody } } = require('../utils')

const configSchema = Joi.object({
  address: Joi.string().uri().required(),
  authorizedTokens: Joi.array().items(Validator.secretToken('authorizedToken')).required()
})

const socketUser = 'user'

class SocketServer {
  constructor (config) {
    Validator.oneTimeValidation(configSchema, config)

    this.router = null
    this.authhandler = null
    this.config = config
    this.logger = Logger(this.constructor.name)
  }

  async start () {
    if (this.router !== null) { throw new Error('server already started') }
    this.authHandler = new AuthHandler(this.config.authorizedTokens)
    this.router = new Router({
      maxMessageSize: 4 * 1024,
      linger: 0
    })
    this.router.plainServer = true
    await this.router.bind(this.config.address)

    this.logger.info('listening on address', this.config.address)
    this.authHandler.run()
    this.serverLoop()
  }

  async serverLoop () {
    // try {
    for await (const [path, mid, mbody] of this.router) {
      const messageId = mid.toString()
      const data = parseMessageBody(mbody)
      this.logger.debug('received:', messageId, data)

      const responseData = createMessageBody(await this._internalReceived(data))
      this.logger.debug('response:', messageId, responseData)
      await this.router.send([path, mid, responseData])
    }
  }

  _internalReceived (data) {
    return this.received(data)
      .catch(err => {
        this.logger.error('processing error:', err.message, err)
        return err.clientResponse
          ? err.clientResponse
          : error(data)
      })
  }

  stop () {
    this.logger.debug('closing auth/server socket')
    if (this.authHandler) { this.authHandler.close() }
    if (this.router) { this.router.close() }
    this.authHandler = null
    this.router = null
    this.logger.info('stopped')
  }

  received (request) { return Promise.resolve(request) }
}

class AuthHandler {
  constructor (authorizedTokens) {
    this.logger = Logger(this.constructor.name)
    this.socket = new Router({ linger: 0 })
    this.authorizedTokens = authorizedTokens
  }

  async run () {
    await this.socket.bind('inproc://zeromq.zap.01')
    for await (const request of this.socket) {
      const [path, delimiter, version, id] = request
      const [mechanism, user, authToken] = request.slice(7).map(p => p.toString())

      const status = mechanism.toString() === 'PLAIN' && user && authToken
        ? this.authorizedTokens.includes(authToken) && user === socketUser
          ? ['200', 'OK']
          : ['400', 'Bad credentials']
        : ['401', 'Authentication required']

      this.logger.info('auth result:', status)
      await this.socket.send([path, delimiter, version, id, ...status, null, null])
    }
  }

  close () {
    this.socket.close()
  }
}

module.exports = SocketServer
