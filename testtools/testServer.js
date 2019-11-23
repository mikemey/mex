const uws = require('uWebSockets.js')
const { LogTrait } = require('../utils')

class TestServer extends LogTrait {
  constructor (port, path) {
    super()
    this.port = port
    this.path = path
    this.received = { authTokens: [] }
    this.listenSocket = null
  }

  start () {
    return new Promise((resolve, reject) => {
      uws.App({}).ws(this.path, {
        open: (_, req) => {
          this.log('incoming connection')
          this.received.authTokens.push(req.getHeader('x-auth-token'))
        }
      }).listen(this.port, socket => {
        this.log(`listening on: ${this.port}`)
        this.listenSocket = socket
        if (socket) { resolve() }
      })
    })
  }

  stop () {
    return new Promise((resolve, reject) => {
      this.log('stop')
      if (this.listenSocket) {
        uws.us_listen_socket_close(this.listenSocket)
        this.listenSocket = null
      }
      resolve()
    })
  }
}

module.exports = TestServer
