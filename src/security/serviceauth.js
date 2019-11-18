const uws = require('uWebSockets.js')

const LogTrait = require('../utils/logtrait')

class ServiceAuth extends LogTrait {
  constructor (options) {
    super()
    this.listenSocken = null
    this.path = options.path
    this.port = options.port
    this.authorizedKeys = options.authorizedKeys
  }

  start () {
    return new Promise((resolve, reject) => {
      uws.App({}).ws(this.path, {
        open: (ws, req) => {
          this.log('websocket opened')

          const authToken = req.getHeader('x-auth-token')
          if (!this.authorizedKeys.includes(authToken)) {
            this.log('authorization failed, closing socket')
            return ws.close()
          }
          this.log('authorization successful')
        },
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
}

module.exports = ServiceAuth
