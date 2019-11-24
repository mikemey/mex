const WebSocket = require('ws')

const { LogTrait } = require('../utils')

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

class TestClient extends LogTrait {
  constructor (port, path, token) {
    super()
    this.ws = null
    this.wsconfig = { port, path }
    this._defaultInterceptors = {
      headers: { 'X-AUTH-TOKEN': token },
      afterSendAction: null
    }
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
      this.log(`connecting to ${url}`)
      this.ws = new WebSocket(url, { headers: this.interceptors.headers })
      this.ws.on('open', () => {
        this.log('connected')
        resolve()
      })
      this.ws.on('error', err => {
        this.log('error:', err)
        reject(err)
      })
    })
  }

  send (request) {
    if (this.ws === null) throw Error('not initialized')
    return new Promise((resolve, reject) => {
      this.ws.on('message', raw => {
        this.log(`on message: [${raw}]`)
        resolve(JSON.parse(raw))
      })
      this.ws.on('close', (code, reason) => {
        this.log(`on close: ${code} [${reason}]`)
        resolve()
      })
      this.ws.on('error', err => {
        this.log('on error', err)
        reject(err)
      })
      this.log('sending:', request)
      const message = JSON.stringify(request)
      this.ws.send(message, err => {
        if (err) {
          this.log('sending error:', err)
          reject(err)
        } else {
          this.log('sending done')
        }
      })
      if (this.interceptors.afterSendAction) {
        this.log('running afterSendAction')
        this.interceptors.afterSendAction(this.ws)
      }
    })
  }

  close () {
    return isConnected(this.ws)
      .then(isConnected => new Promise((resolve, reject) => {
        if (!isConnected) { return resolve() }

        this.log('closing connection...')
        const closeTimeout = this._createTimeout(reject, 'closing timed out')
        const success = name => () => {
          clearTimeout(closeTimeout)
          this.log(`FINISHED from ${name}`)
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
      this.log(message)
      if (this.ws) { this.ws.removeAllListeners() }
      reject(Error(message))
    }, 200)
  }

  isOpen () {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

module.exports = TestClient
