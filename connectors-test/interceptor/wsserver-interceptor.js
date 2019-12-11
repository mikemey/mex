const uws = require('uWebSockets.js')
const {
  Logger,
  wsmessages: { createRawMessage, extractMessage, OK_STATUS }
} = require('../../utils')

const closeClientSockets = clients => clients.forEach(client => client.close())

class WSServerInterceptor {
  constructor (port, path) {
    this.port = port
    this.path = path
    this.listenSocket = null
    this.defaultResponse = { status: OK_STATUS }
    this._defaultInterceptors = {
      responsePromise: () => Promise.resolve(this.defaultResponse),
      stopProcessing: false,
      afterResponse: null
    }
    this.interceptors = {}
    this.resetInterceptors()
    this.logger = Logger(this.constructor.name)
  }

  resetInterceptors () {
    this.interceptors = Object.assign({}, this._defaultInterceptors)
  }

  start () {
    this.clients = []
    this.received = { authTokens: [], messages: [] }
    return new Promise((resolve, reject) => {
      if (this.listenSocket) {
        return reject(Error('WSServerInterceptor already started'))
      }
      uws.App({}).ws(this.path, {
        open: (ws, req) => {
          this.logger.debug('incoming connection')
          this.received.authTokens.push(req.getHeader('x-auth-token'))
          this.clients.push(ws)
        },
        message: (ws, buffer) => this._processMessage(ws, buffer),
        close: closingWs => {
          this.logger.debug('socket closed')
          this._removeClient(closingWs)
        }
      }).listen(this.port, socket => {
        if (socket) {
          this.logger.debug(`listening on: ${this.port}`)
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
        const message = extractMessage(rawMessage)
        receivedMessageId = message.id
        this.logger.debug(`received: <${message.id}>`, message.body)
        resolve(message.body)
      } catch (err) { reject(err) }
    }).then(request => {
      this.received.messages.push(request)
      return this.interceptors.responsePromise(ws)
    }).then(response => {
      if (this.interceptors.stopProcessing) {
        this.logger.debug('interceptors.stopProcessing flag is True')
        return
      }
      this.logger.debug(`responding: <${receivedMessageId}>`, response)
      return ws.send(createRawMessage(receivedMessageId, response))
    }).then(sendResultOk => {
      if (this.interceptors.stopProcessing) { return }
      const buffered = ws.getBufferedAmount()
      this.logger.debug(`send result: ${sendResultOk}, backpressure: ${buffered}`)
      if (!sendResultOk || buffered > 0) { throw new Error('WSServerInterceptor: sending failed') }
      if (this.interceptors.afterResponse) {
        return this.interceptors.afterResponse(ws)
      }
    }).catch(err => {
      this.logger.debug('processing error:', err)
      this._removeClient(ws)
    })
  }

  stop () {
    return new Promise(resolve => {
      this.logger.debug('stop')
      if (this.listenSocket) {
        this.logger.debug('closing all sockets...')
        closeClientSockets(this.clients)
        uws.us_listen_socket_close(this.listenSocket)
        this.listenSocket = null
      }
      resolve()
    })
  }
}

module.exports = WSServerInterceptor
