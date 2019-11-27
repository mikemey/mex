const uws = require('uWebSockets.js')
const Joi = require('@hapi/joi')

const { LogTrait, Validator, wsmessages, randomHash } = require('../utils')

const configSchema = Joi.object({
  port: Joi.number().port().required(),
  path: Validator.path,
  authorizedTokens: Joi.array().items(Validator.secretToken('authorizedToken')).required()
})

class WSServer extends LogTrait {
  constructor (config) {
    super()
    this.listenSocken = null
    this.config = config
  }

  start () {
    Validator.oneTimeValidation(configSchema, this.config)
    return new Promise((resolve, reject) => {
      uws.App({}).ws(this.config.path, {
        maxPayloadLength: 4 * 1024,
        open: (ws, req) => {
          const authToken = req.getHeader('x-auth-token')
          if (!this.config.authorizedTokens.includes(authToken)) {
            this.log('authorization failed, closing socket')
            return ws.close()
          }
          ws.log = this.createIdLog(randomHash())
          this._wslog(ws, 'client authorized successful')
        },
        message: (ws, buffer) => this._processMessage(ws, buffer),
        drain: (ws) => this._wslog(ws, 'socket backpressure:', ws.getBufferedAmount()),
        close: (ws, code) => this._wslog(ws, 'socket closed:', code)
      }).listen(this.config.port, socket => {
        if (socket) {
          this.log('listening on port', this.config.port)
          this.listenSocket = socket
          resolve()
        } else {
          const msg = `failed to listen on port ${this.config.port}`
          this.log(msg)
          reject(Error(msg))
        }
      })
    })
  }

  stop () {
    return new Promise(resolve => {
      if (this.listenSocket) {
        this.log('shutting down')
        uws.us_listen_socket_close(this.listenSocket)
        this.listenSocket = null
      } else {
        this.log('already stopped')
      }
      resolve()
    })
  }

  _processMessage (ws, buffer) {
    const incoming = { msg: null, dropConnection: false }
    return new Promise((resolve, reject) => {
      try {
        const raw = String.fromCharCode.apply(null, new Uint8Array(buffer))
        incoming.msg = wsmessages.extractMessage(raw)
        incoming.msg.prettyId = `<${incoming.msg.id}>`
        this._wslog(ws, 'received:', incoming.msg.prettyId, incoming.msg.body)
        resolve(incoming.msg.body)
      } catch (err) { reject(err) }
    }).then(req => this.received(req))
      .catch(err => {
        this._wslog(ws, 'processing error:', err)
        incoming.dropConnection = err.keepConnection !== true
        if (err.clientResponse) { return err.clientResponse }
        return wsmessages.error(incoming.msg.body)
      })
      .then(response => {
        this._wslog(ws, 'responding:', incoming.msg.prettyId, response)
        const message = wsmessages.createRawMessage(incoming.msg.id, response)
        return ws.send(message)
      })
      .then(sendResultOk => {
        const buffered = ws.getBufferedAmount()
        this._wslog(ws, 'send result', incoming.msg.prettyId, 'OK:', sendResultOk, ' buffered:', buffered)

        if (!sendResultOk) { this._sendingError('send result NOK', ws.close.bind(ws)) }
        if (buffered > 0) { this._sendingError(`buffer not empty: ${buffered}`, ws.close.bind(ws)) }
        if (incoming.dropConnection) { this._sendingError('closing connection', ws.end.bind(ws)) }
      })
  }

  _sendingError (message, closeWs) {
    this.log(message)
    closeWs()
  }

  _wslog (ws, ...args) {
    (ws && ws.log) ? ws.log(...args) : this.log(...args)
  }

  received (request) { return Promise.resolve(request) }
}

module.exports = WSServer
