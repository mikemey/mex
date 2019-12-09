const WebSocket = require('ws')
const Joi = require('@hapi/joi')

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
      setTimeout(() => checkStatus(desiredState, resolve), 5)
    } else {
      reject(Error(`waiting for socket state ${desiredState} exceeded retries (max: ${WS_WAIT_RETRIES})`))
    }
  }
  return checkStatus
}

class TimeoutError extends Error {
  constructor (message) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

const topicSubscription = topic => wsmessages.withAction('subscribe').build({ topic })

class WSClient extends LogTrait {
  constructor (config) {
    super()
    Validator.oneTimeValidation(configSchema, config)

    this.wsconfig = config
    this._reset()
  }

  _reset (callback = () => { }) {
    this.log('resetting state')
    this.ws = null
    this.headers = { 'X-AUTH-TOKEN': this.wsconfig.authToken }
    this.messageHandler = {}
    this.topicHandler = {}
    callback()
  }

  _openWebsocket (resolve, reject) {
    this.log('connecting to:', this.wsconfig.url)

    const saveEnding = (endCb, ...args) => {
      this._clearListeners()
      this.log(...args)
      endCb()
    }

    const connectTimeout = this._createTimeout(err => saveEnding(() => reject(err)), 'connecting timed out')

    this.ws = new WebSocket(this.wsconfig.url, { headers: this.headers })
    this.ws.prependOnceListener('open', () => {
      connectTimeout.cancel()
      saveEnding(resolve, 'connection established')
    })

    this.ws.addListener('message', raw => {
      const message = wsmessages.extractMessage(raw)
      const handler = message.isBroadcast ? this.topicHandler[message.topic] : this.messageHandler[message.id]
      const errorId = message.isBroadcast ? message.topic : message.id
      return handler ? handler(message) : this.log('dropping received:', `<${errorId}>`)
    })

    const closedown = error => {
      connectTimeout.cancel()
      const rejectOriginError = () => reject(error)
      saveEnding(() => this._stopSync(rejectOriginError, rejectOriginError), 'connection error:', error)
    }
    this.ws.prependOnceListener('close', closedown)
    this.ws.prependOnceListener('error', closedown)
    this.ws.prependOnceListener('unexpected-response', () => closedown(Error('unexpected-response')))
  }

  send (request) {
    return this._internalSend(request)
  }

  _internalSend (request, callback) {
    return new Promise((resolve, reject) => {
      const waitfor = Waiter(this.ws, reject)
      const interceptResponse = callback ? callback(resolve) : resolve
      const sendMessage = () => this._requestResponse(request, interceptResponse, reject)
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
      this.log('processing error:', err.message, err)
      const sendError = err instanceof TimeoutError ? err : new Error('disconnected')
      throw sendError
    })
  }

  subscribe (topic, callback = (topic, message) => { }) {
    const addTopicCallback = resolve => subscriptionResponse => {
      if (subscriptionResponse.status === wsmessages.OK_STATUS) {
        this.topicHandler[topic] = message => {
          this.log('received:', `<${topic}>`, message.body)
          callback(topic, message.body)
        }
      }
      resolve(subscriptionResponse)
    }
    return this._internalSend(topicSubscription(topic), addTopicCallback)
  }

  _requestResponse (request, resolve, reject) {
    const sendingId = wsmessages.randomMessageId()

    const saveEnding = (func, obj, ...logArgs) => {
      this._clearListeners()
      delete this.messageHandler[sendingId]
      this.log(...logArgs)
      func(obj)
    }

    const responseTimeout = this._createTimeout(err => saveEnding(reject, err, err.message), 'response timed out')

    const handler = message => {
      responseTimeout.cancel()
      saveEnding(resolve, message.body, 'received:', `<${message.id}>`, message.body)
    }

    const saveReject = (err, message) => {
      responseTimeout.cancel()
      saveEnding(reject, err, message)
    }

    this.messageHandler[sendingId] = handler
    this.ws.prependOnceListener('close', () => saveReject(new TimeoutError('remote socket closed'), 'requestResponse close'))
    this.ws.prependOnceListener('unexpected-response', err => saveReject(err, 'requestResponse unexpected-response'))
    this.ws.prependOnceListener('error', err => saveReject(err, 'requestResponse error'))

    this.log('sending:', `<${sendingId}>`, request)
    this.ws.send(wsmessages.createRawMessage(sendingId, request), err => err
      ? saveReject(err, 'sending error')
      : this.log('sending done')
    )
  }

  stop () {
    return new Promise((resolve, reject) => this._stopSync(resolve, reject))
  }

  _stopSync (resolve = () => { }, reject = () => { }) {
    this.log('stopping...')
    if (this.ws === null) return resolve()

    const waitfor = Waiter(this.ws, reject)
    const finalise = () => {
      this.log('stopped')
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
      this._clearListeners()
      this.log(message)
      resolve()
    }
    const closeTimeout = this._createTimeout(err => saveEnding(err.message), 'closing timed out')

    const cleanup = message => err => {
      closeTimeout.cancel()
      if (err) { message = `${message} ${err}` }
      saveEnding(message)
    }
    this.ws.prependOnceListener('close', cleanup('closed'))
    this.ws.prependOnceListener('error', cleanup('error closing:'))
    this.ws.prependOnceListener('unexpected-response', cleanup('unexpected-response'))
    this.ws.close()
  }

  _createTimeout (reject, message) {
    const timeout = setTimeout(() => {
      reject(new TimeoutError(message))
    }, this.wsconfig.timeout)

    const cancel = () => {
      clearTimeout(timeout)
    }
    return { cancel }
  }

  _clearListeners () {
    if (this.ws != null) {
      this.ws.removeAllListeners('open')
      this.ws.removeAllListeners('close')
      this.ws.removeAllListeners('error')
      this.ws.removeAllListeners('unexpected-response')
      this.ws.removeAllListeners('close')
    }
  }
}

module.exports = WSClient
