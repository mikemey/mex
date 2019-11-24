const uws = require('uWebSockets.js')
const Joi = require('@hapi/joi')

const { LogTrait, Validator, wsmessages } = require('../utils')

const configSchema = Joi.object({
  port: Joi.number().port().required(),
  path: Validator.path,
  authorizedTokens: Joi.array().items(Validator.secretToken('authorizedToken')).required()
})

class WSAuth extends LogTrait {
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
          this.log('client authorized successful')
        },
        message: (ws, buffer, isBinary) => this._processMessage(ws, buffer, isBinary),
        drain: (ws) => {
          this.log(`socket backpressure: ${ws.getBufferedAmount()}`)
        },
        close: (ws, code, message) => {
          this.log('socket closed log ws.id (new) and code')
        }
      }).listen(this.config.port, socket => {
        if (socket) {
          this.log(`listening on port ${this.config.port}`)
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

  _processMessage (ws, buffer, isBinary) {
    const data = { originalReq: null, closeConnection: false }
    return new Promise((resolve, reject) => {
      try {
        const message = String.fromCharCode.apply(null, new Uint8Array(buffer))
        data.originalReq = JSON.parse(message)
        this.log('received:', data.originalReq)
        resolve(data.originalReq)
      } catch (err) { reject(err) }
    }).then(req => this.received(req))
      .catch(err => {
        this.log('processing error:', err)
        if (err.fatal) { data.closeConnection = true }
        if (err.clientResponse) { return err.clientResponse }
        this.errorLog(err)
        return wsmessages.error(data.originalReq)
      })
      .then(response => {
        this.log('responding:', response)
        const message = JSON.stringify(response)
        return ws.send(message, isBinary)
      })
      .then(sendResultOk => {
        const buffered = ws.getBufferedAmount()
        this.log(`send result: ${sendResultOk}, backpressure: ${buffered}`)
        if (!sendResultOk) { this.sendingError('send result NOK', ws.close.bind(ws)) }
        if (buffered > 0) { this.sendingError(`buffer not empty: ${buffered}`, ws.close.bind(ws)) }
        if (data.closeConnection) { this.sendingError('closing connection', ws.end.bind(ws)) }
      })
  }

  sendingError (message, closeWs) {
    this.errorLog(message)
    closeWs()
  }

  received (request) { return Promise.resolve(request) }
}

module.exports = WSAuth
