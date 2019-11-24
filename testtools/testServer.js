const uws = require('uWebSockets.js')
const { LogTrait } = require('../utils')

const closeClientSockets = clients => clients.forEach(client => client.close())

class TestServer extends LogTrait {
  constructor (port, path) {
    super()
    this.port = port
    this.path = path
    this.listenSocket = null
    this.oneTimeResponsePromise = null
  }

  start () {
    this.clients = []
    this.received = { authTokens: [], messages: [] }
    this.nextResponse = { status: 'ok' }
    this.oneTimeResponsePromise = null
    return new Promise((resolve, reject) => {
      if (this.listenSocket) {
        return reject(Error('TestServer already started'))
      }
      uws.App({}).ws(this.path, {
        open: (ws, req) => {
          this.log('incoming connection')
          this.received.authTokens.push(req.getHeader('x-auth-token'))
          this.clients.push(ws)
        },
        message: (ws, buffer) => this._processMessage(ws, buffer),
        close: closingWs => {
          this.log('socket closed')
          this._removeClient(closingWs)
        }
      }).listen(this.port, socket => {
        if (socket) {
          this.log(`listening on: ${this.port}`)
          this.listenSocket = socket
          resolve()
        }
      })
    })
  }

  _removeClient (client) {
    this.clients = this.clients.filter(c => c !== client)
  }

  _processMessage (ws, buffer) {
    return new Promise((resolve, reject) => {
      try {
        const message = String.fromCharCode.apply(null, new Uint8Array(buffer))
        const req = JSON.parse(message)
        this.log('received:', req)
        resolve(req)
      } catch (err) { reject(err) }
    }).then(req => this.responseFor(req))
      .then(response => {
        this.log('responding:', response)
        const message = JSON.stringify(response)
        return ws.send(message)
      })
      .then(sendResultOk => {
        const buffered = ws.getBufferedAmount()
        this.log(`send result: ${sendResultOk}, backpressure: ${buffered}`)
        if (!sendResultOk || buffered > 0) { throw new Error('TestServer: sending failed') }
      })
      .catch(err => {
        this.log('processing error', err)
        this._removeClient(ws)
      })
  }

  responseFor (request) {
    this.received.messages.push(request)
    const responsePromise = this.oneTimeResponsePromise === null
      ? Promise.resolve(this.nextResponse)
      : this.oneTimeResponsePromise
    this.oneTimeResponsePromise = null
    return responsePromise
  }

  stop () {
    return new Promise((resolve, reject) => {
      this.log('stop')
      if (this.listenSocket) {
        this.log('closing all sockets...')
        closeClientSockets(this.clients)
        uws.us_listen_socket_close(this.listenSocket)
        this.listenSocket = null
      }
      resolve()
    })
  }
}

module.exports = TestServer
