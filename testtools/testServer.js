const uws = require('uWebSockets.js')
class TestServer {
  constructor (port, path) {
    this.port = port
    this.path = path
    this.received = { authTokens: [] }
    this.listenSocket = null
  }

  start () {
    return new Promise((resolve, reject) => {
      uws.App({}).ws(this.path, {
        open: (ws, req) => {
          console.log(`MOCK SERVER connected: ${ws.getRemoteAddress()}`)
          this.received.authTokens.push(req.getHeader('x-auth-token'))
        }
      }).listen(this.port, socket => {
        console.log(`MOCK SERVER open: ${this.port}`)
        this.listenSocket = socket
        if (socket) { resolve() }
      })
    })
  }

  stop () {
    return new Promise((resolve, reject) => {
      console.log('MOCK SERVER stop')
      if (this.listenSocket) {
        uws.us_listen_socket_close(this.listenSocket)
        this.listenSocket = null
      }
      resolve()
    })
  }

  getReceived () { return this.received }
}

module.exports = TestServer
