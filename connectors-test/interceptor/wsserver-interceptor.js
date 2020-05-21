const Websocket = require('ws')
const {
  Logger,
  wsmessages: { createRawMessage, extractMessage, OK_STATUS }
} = require('../../utils')

class WSServerInterceptor {
  constructor (port, path) {
    this.server = null
    this.port = port
    this.path = path
    this.defaultResponse = { status: OK_STATUS }
    this._defaultInterceptors = {
      responsePromise: () => Promise.resolve(this.defaultResponse),
      stopProcessing: false
    }
    this.interceptors = {}
    this.resetInterceptors()
    this.logger = Logger(this.constructor.name)
  }

  resetInterceptors () {
    this.interceptors = Object.assign({}, this._defaultInterceptors)
  }

  start () {
    this.received = { authTokens: [], messages: [] }
    return new Promise((resolve, reject) => {
      this.server = new Websocket.Server({ port: this.port, path: this.path })
      this.server.on('error', reject)
      this.server.on('listening', () => {
        this.logger.debug(`listening on: ${this.port}`)
        resolve()
      })

      this.server.on('connection', (ws, req) => {
        this.logger.debug('incoming connection')
        this.received.authTokens.push(req.headers['x-auth-token'])

        ws.on('message', data => this._processMessage(ws, data))
        ws.on('close', () => {
          this.logger.debug('socket closed')
        })
      })
    })
  }

  _processMessage (ws, rawMessage) {
    let receivedMessageId = ''
    return new Promise((resolve, reject) => {
      try {
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
    }).then(() => {
      if (this.interceptors.stopProcessing) { return }
      this.logger.debug('sending done')
    }).catch(err => {
      this.logger.debug('processing error:', err)
    })
  }

  stop () {
    return new Promise(resolve => {
      this.logger.debug('stop')
      if (this.server !== null) {
        this.logger.debug('closing all sockets...')
        this.server.close(resolve)
        this.server = null
      }
      resolve()
    })
  }
}

module.exports = WSServerInterceptor
