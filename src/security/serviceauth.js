const uws = require('uWebSockets.js')

const LogTrait = require('../utils/logtrait')

class ServiceAuth extends LogTrait {
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
        open: (ws, req) => {
          const authToken = req.getHeader('x-auth-token')
          if (!this.authorizedKeys.includes(authToken)) {
            this.log('authorization failed, closing socket')
            return ws.close()
          }
          this.log('client authorized successful')
        },
        message: (ws, buffer, isBinary) => this._processMessage(ws, buffer, isBinary),
        close: (ws, code, message) => {
          this.log('websocket closed')
        }
      }).listen(this.port, socket => {
        if (socket) {
          this.log(`listening on port ${this.port}`)
          this.listenSocket = socket
          resolve()
        } else {
          const msg = `already started on port ${this.port}`
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
  }

  _processMessage (ws, buffer, isBinary) {
    let requestObject = {}
    return new Promise((resolve, reject) => {
      try {
        const message = String.fromCharCode.apply(null, new Uint8Array(buffer))
        requestObject = JSON.parse(message)
        resolve(requestObject)
      } catch (err) { reject(err) }
    }).then(req => this.received(req))
      .catch(err => {
        this.log('processing error', err)
        return { status: 'error', message: requestObject }
      })
      .then(response => {
        const message = JSON.stringify(response)
        return ws.send(message, isBinary)
      })
  }

  received (request) { return Promise.resolve(request) }
}

module.exports = ServiceAuth
