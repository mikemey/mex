const WebSocket = require('ws')
const Joi = require('@hapi/joi')
const util = require('util')
const setTimeoutPromise = util.promisify(setTimeout)

const { LogTrait } = require('../utils')

const configSchema = Joi.object({
  url: Joi.string().uri().required(),
  authToken: Joi.string().min(20).message('"authToken" too short').required(),
  timeout: Joi.number().min(20).max(2000).required()
})

const validateConfig = config => {
  const validation = configSchema.validate(config)
  if (validation.error) {
    throw new Error(validation.error.message)
  }
}

class WSClient extends LogTrait {
  constructor (config) {
    super()
    this.wsconfig = config
    validateConfig(this.wsconfig)
    this.ws = null
    this.headers = { 'X-AUTH-TOKEN': this.wsconfig.authToken }
  }

  _isConnected () {
    if (this.ws === null) return Promise.resolve(false)
    switch (this.ws.readyState) {
      case WebSocket.CLOSED:
        return Promise.resolve(false)
      case WebSocket.CLOSING:
      case WebSocket.CONNECTING:
        return setTimeoutPromise(1).then(() => this._isConnected(this.ws))
      case WebSocket.OPEN:
        return Promise.resolve(true)
      default: throw new Error(`unexpected WebSocket state [${this.ws.readyState}]`)
    }
  }

  _openConnection () {
    return new Promise((resolve, reject) => {
      this.log(`connecting to: ${this.wsconfig.url}`)
      this.ws = new WebSocket(this.wsconfig.url, { headers: this.headers })
      this.ws.prependOnceListener('open', () => {
        this.log('connection established')
        resolve()
      })
      this.ws.prependOnceListener('close', (code, reason) => {
        this.log(`connection closed [${code}] (${reason})`)
        this.ws = null
      })
      this.ws.prependOnceListener('unexpected-response', (req, res) => {
        this.log('connection unexpected-response')
      })
      this.ws.prependOnceListener('error', error => {
        reject(error)
        this.ws = null
      })
    }).catch(err => {
      this.log(err.message)
      this.ws = null
      throw new Error('disconnected')
    })
  }

  send (request) {
    return this._isConnected()
      .then(isOpen => isOpen || this._openConnection())
      .then(() => this._requestResponse(request))
  }

  _requestResponse (request) {
    return new Promise((resolve, reject) => {
      if (this.ws === null) { return reject(Error('disconnected')) }

      const responseTimeout = this._createTimeout(reject, 'response timed out')
      this.ws.prependOnceListener('message', raw => {
        clearTimeout(responseTimeout)
        this.log(`received: [${raw}]`)
        resolve(JSON.parse(raw))
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
    })
  }

  stop () {
    return this._isConnected()
      .then(isConnected => new Promise((resolve, reject) => {
        if (!isConnected) { return resolve() }
        this.log('closing connection...')

        const closeTimeout = this._createTimeout(reject, 'closing timed out')
        const success = () => {
          clearTimeout(closeTimeout)
          this.log('closed')
          resolve()
        }

        this.ws.prependOnceListener('close', success)
        this.ws.prependOnceListener('error', success)
        this.ws.close()
      }))
      .finally(() => { this.ws = null })
  }

  _createTimeout (reject, message) {
    return setTimeout(() => {
      this.log(message)
      if (this.ws) { this.ws.removeAllListeners('message') }
      reject(Error(message))
    }, this.wsconfig.timeout)
  }
}

module.exports = WSClient
