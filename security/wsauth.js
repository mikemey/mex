const uws = require('uWebSockets.js')

const { LogTrait, wsmessages } = require('../utils')

class WSAuth extends LogTrait {
  constructor (config) {
    super()
    this.listenSocken = null
    this.path = config.path
    this.port = config.port
    this.authorizedKeys = config.authorizedKeys
  }

  start () {
    return new Promise((resolve, reject) => {
      uws.App({}).ws(this.path, {
        maxPayloadLength: 4 * 1024,
        open: (ws, req) => {
          const authToken = req.getHeader('x-auth-token')
          if (!this.authorizedKeys.includes(authToken)) {
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
          this.log('socket closed')
        }
      }).listen(this.port, socket => {
        if (socket) {
          this.log(`listening on port ${this.port}`)
          this.listenSocket = socket
          resolve()
        } else {
          const msg = `failed to listen on port ${this.port}`
          this.log(msg)
          reject(Error(msg))
        }
      })
    })
  }

  stop () {
    if (this.listenSocket) {
      this.log('shutting down')
      uws.us_listen_socket_close(this.listenSocket)
      this.listenSocket = null
    } else {
      this.log('already stopped')
    }
    return Promise.resolve()
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
      .then(sendResult => {
        const buffered = ws.getBufferedAmount()
        this.log(`send result: ${sendResult}, backpressure: ${buffered}`)
        if (buffered > 0) { throw new Error('deal with backpressure!') }
        if (data.closeConnection) {
          this.log('closing connection')
          return ws.end()
        }
      })
  }

  received (request) { return Promise.resolve(request) }
}

module.exports = WSAuth
