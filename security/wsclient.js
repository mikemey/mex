const WebSocket = require('ws')
const Joi = require('@hapi/joi')
const util = require('util')
const setTimeoutPromise = util.promisify(setTimeout)

const { LogTrait, Validator, wsmessages } = require('../utils')

const configSchema = Joi.object({
  url: Joi.string().uri().required(),
  authToken: Validator.secretToken('authToken'),
  timeout: Joi.number().min(20).max(2000).required()
})

const WS_WAIT_RETRIES = 5

const Waiter = (ws, reject) => {
  let retries = WS_WAIT_RETRIES

  const checkStatus = (desiredState, resolve = err => { throw err }) => {
    if (ws.readyState === desiredState) {
      return resolve()
    }
    retries--
    if (retries > 0) {
      setTimeout(() => checkStatus(desiredState, resolve), 1)
    } else {
      reject(Error(`waiting for socket state ${desiredState} exceeded retries (max: ${WS_WAIT_RETRIES})`))
    }
  }
  return checkStatus
}

class TimeoutError extends Error {
  constructor (message) {
    super(message)
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor)
  }
}

class WSClient extends LogTrait {
  constructor (config) {
    super()
    this.debug = true
    this.wsconfig = config
    Validator.oneTimeValidation(configSchema, this.wsconfig)
    this._reset()
  }

  _reset (callback = () => { }) {
    this.log('resetting state')
    this.ws = null
    this.shutdownFlag = false // do we need this really?
    this.headers = { 'X-AUTH-TOKEN': this.wsconfig.authToken }
    callback()
  }

  _openWebsocket (resolve, reject) {
    this.log(`connecting to: ${this.wsconfig.url}`)

    const saveEnding = (endCb, ...args) => {
      if (this.ws != null) { this.ws.removeAllListeners() }
      this.log(...args)
      endCb()
    }

    const connectTimeout = this._createTimeout(err => saveEnding(() => reject(err)), 'connecting timed out')

    this.ws = new WebSocket(this.wsconfig.url, { headers: this.headers })
    this.ws.prependOnceListener('open', () => {
      clearTimeout(connectTimeout)
      saveEnding(resolve, 'connection established')
    })
    const closedown = error => {
      clearTimeout(connectTimeout)
      const rejectOriginError = () => reject(error)
      saveEnding(() => this._stopSync(rejectOriginError, rejectOriginError), `connection error: ${error}`)
    }
    this.ws.prependOnceListener('error', closedown)
    this.ws.prependOnceListener('unexpected-response', () => closedown(Error('unexpected-response')))
  }

  send (request) {
    return new Promise((resolve, reject) => {
      const waitfor = Waiter(this.ws, reject)
      const sendMessage = () => this._requestResponse(request, resolve, reject)
      const openAndSendMessage = () => this._openWebsocket(sendMessage, reject)

      const state = this.ws === null ? WebSocket.CLOSED : this.ws.readyState
      switch (state) {
        case WebSocket.CLOSED: return openAndSendMessage()
        case WebSocket.CLOSING: return waitfor(WebSocket.CLOSED, openAndSendMessage)
        case WebSocket.CONNECTING: return waitfor(WebSocket.OPEN, sendMessage)
        case WebSocket.OPEN: return sendMessage()
        default: return reject(Error(`unexpected WebSocket state [${this.ws.readyState}]`))
      }
    }).catch(err => {
      this.log(`processing error: ${err.message}`)
      this.errorLog(err)
      const sendError = err instanceof TimeoutError ? err : new Error('disconnected')
      throw sendError
    })
  }

  _requestResponse (request, resolve, reject) {
    const saveEnding = (func, obj, ...logArgs) => {
      if (this.ws != null) { this.ws.removeAllListeners() }
      this.log(...logArgs)
      func(obj)
    }

    const responseTimeout = this._createTimeout(err => saveEnding(reject, err, err.message), 'response timed out')

    const sendingId = wsmessages.randomMessageId()
    this.ws.addListener('message', raw => {
      clearTimeout(responseTimeout)
      const message = wsmessages.extractMessage(raw)
      if (message.id === sendingId) {
        saveEnding(resolve, message.body, `received: <# ${message.id}>`, message.body)
      } else {
        this.log(`dropping received: <# ${message.id}>`)
      }
    })

    const saveReject = (err, ...args) => {
      clearTimeout(responseTimeout)
      saveEnding(reject, err, ...args)
    }

    this.ws.prependOnceListener('error', err => saveReject(err, 'requestResponse error'))

    this.log(`sending: <# ${sendingId}>`, request)
    this.ws.send(wsmessages.createRawMessage(sendingId, request), err => {
      if (err) { saveReject(err, 'sending error') }
      else { this.log('sending done') }
    })
  }

  stop () {
    return new Promise((resolve, reject) => this._stopSync(resolve, reject))
  }

  _stopSync (resolve = () => { }, reject = () => { }) {
    if (this.ws === null) return resolve()

    const waitfor = Waiter(this.ws, reject)
    const finalise = () => {
      this._reset(resolve)
    }
    const closeSocket = () => this._closeWebsocket(finalise)

    const state = this.ws.readyState
    switch (state) {
      case WebSocket.CLOSED: return finalise()
      case WebSocket.CLOSING: return waitfor(WebSocket.CLOSED, finalise)
      case WebSocket.CONNECTING: return waitfor(WebSocket.OPEN, closeSocket)
      case WebSocket.OPEN: return closeSocket()
      default: return reject(Error(`unexpected WebSocket state [${this.ws.readyState}]`))
    }
  }

  _closeWebsocket (resolve) {
    this.log('closing connection...')
    const saveEnding = message => {
      if (this.ws != null) { this.ws.removeAllListeners() }
      this.log(message)
      resolve()
    }
    const closeTimeout = this._createTimeout(err => saveEnding(err.message), 'closing timed out')

    const cleanup = message => err => {
      clearTimeout(closeTimeout)
      if (err) { message = `${message} ${err}` }
      saveEnding(message)
    }
    this.ws.prependOnceListener('close', cleanup('closed'))
    this.ws.prependOnceListener('error', cleanup('error closing:'))
    this.ws.close()
  }

  _createTimeout (reject, message) {
    return setTimeout(() => {
      reject(new TimeoutError(message))
    }, this.wsconfig.timeout)
  }
}

module.exports = WSClient
