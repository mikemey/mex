const uws = require('uWebSockets.js')
const { LogTrait, wsmessages } = require('../utils')

const closeClientSockets = clients => clients.forEach(client => client.close())

class WSAuthMock extends LogTrait {
  constructor (port, path) {
    super()
    this.port = port
    this.path = path
    this.listenSocket = null
    this.defaultResponse = { status: 'ok' }
    this._defaultInterceptors = {
      responsePromise: () => Promise.resolve(this.defaultResponse),
      stopProcessing: false,
      afterResponse: null
    }
    this.interceptors = {}
    this.resetInterceptors()
  }

  resetInterceptors () {
    this.interceptors = Object.assign({}, this._defaultInterceptors)
  }

  start () {
    this.clients = []
    this.received = { authTokens: [], messages: [] }
    return new Promise((resolve, reject) => {
      if (this.listenSocket) {
        return reject(Error('WSAuthMock already started'))
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
    let receivedMessageId = ''
    return new Promise((resolve, reject) => {
      try {
        const rawMessage = String.fromCharCode.apply(null, new Uint8Array(buffer))
        const message = wsmessages.extractMessage(rawMessage)
        receivedMessageId = message.id
        this.log(`received: <# ${message.id}>`, message.body)
        resolve(message.body)
      } catch (err) { reject(err) }
    }).then(request => {
      this.received.messages.push(request)
      return this.interceptors.responsePromise(ws)
    }).then(response => {
      if (this.interceptors.stopProcessing) {
        this.log('interceptors.stopProcessing flag is True')
        return
      }
      this.log(`responding: <# ${receivedMessageId}>`, response)
      return ws.send(wsmessages.createRawMessage(receivedMessageId, response))
    }).then(sendResultOk => {
      if (this.interceptors.stopProcessing) { return }
      const buffered = ws.getBufferedAmount()
      this.log(`send result: ${sendResultOk}, backpressure: ${buffered}`)
      if (!sendResultOk || buffered > 0) { throw new Error('WSAuthMock: sending failed') }
      if (this.interceptors.afterResponse) {
        return this.interceptors.afterResponse(ws)
      }
    }).catch(err => {
      this.log('processing error', err)
      this._removeClient(ws)
    })
  }

  stop () {
    return new Promise(resolve => {
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

module.exports = WSAuthMock
