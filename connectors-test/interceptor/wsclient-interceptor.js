const WebSocket = require('ws')

const { wsmessages, Logger } = require('../../utils')

const isConnected = ws => {
  if (ws === null) return Promise.resolve(false)
  switch (ws.readyState) {
    case WebSocket.CLOSED:
    case WebSocket.CLOSING:
    case WebSocket.CONNECTING:
      return Promise.resolve(false)
    case WebSocket.OPEN:
      return Promise.resolve(true)
    default: throw new Error(`unexpected WebSocket state [${ws.readyState}]`)
  }
}

class WSClientInterceptor {
  constructor (port, path, token) {
    this.ws = null
    this.wsconfig = { port, path }
    this._defaultInterceptors = {
      headers: { 'X-AUTH-TOKEN': token },
      afterSendAction: null
    }
    this.logger = Logger(this.constructor.name)
    this.interceptors = {}
    this.resetInterceptors()
  }

  resetInterceptors () {
    this.interceptors = Object.assign({}, this._defaultInterceptors)
  }

  connect (wsconfigOverride) {
    const connectConfig = Object.assign({}, this.wsconfig, wsconfigOverride)

    return new Promise((resolve, reject) => {
      const url = `ws://localhost:${connectConfig.port}${connectConfig.path}`
      this.logger.debug('connecting to', url)
      this.ws = new WebSocket(url, { headers: this.interceptors.headers })
      this.ws.on('open', () => {
        this.logger.debug('connected')
        resolve()
      })
      this.ws.on('error', err => {
        this.logger.debug('error:', err)
        reject(err)
      })
    })
  }

  send (request) {
    if (this.ws === null) throw Error('not initialized')
    return new Promise((resolve, reject) => {
      this.ws.on('message', raw => {
        this.logger.debug(`on message: [${raw}]`)
        const incoming = wsmessages.extractMessage(raw)
        resolve(incoming.body)
      })
      this.ws.on('close', (code, reason) => {
        this.logger.debug(`on close: ${code} [${reason}]`)
        resolve()
      })
      this.ws.on('error', err => {
        this.logger.debug('on error', err)
        reject(err)
      })
      this.logger.debug('sending:', request)
      const message = wsmessages.createRawMessage(wsmessages.randomMessageId(), request)
      this.ws.send(message, err => {
        if (err) {
          this.logger.debug('sending error:', err)
          reject(err)
        } else {
          this.logger.debug('sending done')
        }
      })
      if (this.interceptors.afterSendAction) {
        this.logger.debug('running afterSendAction')
        this.interceptors.afterSendAction(this.ws)
      }
    })
  }

  close () {
    return isConnected(this.ws)
      .then(isConnected => new Promise((resolve, reject) => {
        if (!isConnected) { return resolve() }

        this.logger.debug('closing connection...')
        const closeTimeout = this._createTimeout(reject, 'closing timed out')
        const success = name => () => {
          clearTimeout(closeTimeout)
          this.logger.debug(`FINISHED from ${name}`)
          resolve()
        }
        this.ws.prependOnceListener('close', success('close'))
        this.ws.prependOnceListener('message', success('message'))
        this.ws.prependOnceListener('error', success('error'))
        this.ws.prependOnceListener('unexpected-response', success('unexpected-response'))

        this.ws.close()
      }))
      .finally(() => { this.ws = null })
  }

  _createTimeout (reject, message) {
    return setTimeout(() => {
      this.logger.debug(message)
      if (this.ws) { this.ws.removeAllListeners() }
      reject(Error(message))
    }, 200)
  }

  isOpen () {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

module.exports = WSClientInterceptor
