const WebSocket = require('ws')
const Joi = require('@hapi/joi')

const { Logger, Validator, wsmessages } = require('../utils')

const configSchema = Joi.object({
  url: Joi.string().uri().required(),
  authToken: Validator.secretToken('authToken'),
  timeout: Joi.number().min(20).max(60000).required()
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
const topicUnsubscribe = topic => wsmessages.withAction('unsubscribe').build({ topic })

class WSClient {
  constructor (config, logCategory) {
    if (!logCategory) { throw Error('logCategory required') }
    Validator.oneTimeValidation(configSchema, config)

    this.logger = Logger(logCategory)
    this.wsconfig = config
    this._reset()
  }

  _reset (callback = () => { }) {
    this.logger.debug('resetting state')
    this._clearListeners(true)
    this.ws = null
    this.headers = { 'X-AUTH-TOKEN': this.wsconfig.authToken }
    this.messageHandler = {}
    this.topicHandler = {}
    callback()
  }

  _openWebsocket (resolve, reject) {
    this.logger.info('connecting to:', this.wsconfig.url)

    const saveEnding = (endCb, ...args) => {
      this._clearListeners()
      this.logger.debug(...args)
      endCb()
    }

    const connectTimeout = this._createTimeout(
      err => saveEnding(() => reject(err), 'connecting timed out'),
      'connecting timed out'
    )

    this.ws = new WebSocket(this.wsconfig.url, { headers: this.headers })
    this.ws.prependOnceListener('open', () => {
      connectTimeout.cancel()
      saveEnding(resolve, 'connection established')
    })

    this.ws.addListener('message', raw => {
      const message = wsmessages.extractMessage(raw)
      const handler = message.isBroadcast ? this.topicHandler[message.topic] : this.messageHandler[message.id]
      const errorId = message.isBroadcast ? message.topic : message.id
      return handler ? handler(message) : this.logger.info('dropping received:', `<${errorId}>`)
    })

    const closedown = error => {
      connectTimeout.cancel()
      saveEnding(() => reject(error), 'connection error:', error)
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
        case WebSocket.CLOSED: {
          this.logger.debug('socket closed, openAndSendMessage')
          return openAndSendMessage()
        }
        case WebSocket.CLOSING: {
          this.logger.debug('socket closing, waitfor(WebSocket.CLOSED, openAndSendMessage)')
          return waitfor(WebSocket.CLOSED, openAndSendMessage)
        }
        case WebSocket.CONNECTING: {
          this.logger.debug('socket connecting, waitfor(WebSocket.OPEN, sendMessage)')
          return waitfor(WebSocket.OPEN, sendMessage)
        }
        case WebSocket.OPEN: return sendMessage()
        default: return reject(Error(`unexpected WebSocket state [${this.ws.readyState}]`))
      }
    }).catch(err => {
      this.logger.error('processing error:', err.message, err)
      const sendError = err instanceof TimeoutError ? err : new Error('disconnected')
      this._stopSync()
      throw sendError
    })
  }

  subscribe (topic, callback = (topic, message) => { }) {
    const addTopicCallback = resolve => subscriptionResponse => {
      if (subscriptionResponse.status === wsmessages.OK_STATUS) {
        this.topicHandler[topic] = message => {
          this.logger.debug('received:', `<${topic}>`, message.body)
          callback(topic, message.body)
        }
      }
      resolve(subscriptionResponse)
    }
    return this._internalSend(topicSubscription(topic), addTopicCallback)
  }

  unsubscribe (topic) {
    return this._internalSend(topicUnsubscribe(topic))
  }

  _requestResponse (request, resolve, reject) {
    const sendingId = wsmessages.randomMessageId()

    const saveEnding = (func, obj, logFunc, ...logArgs) => {
      this._clearListeners()
      delete this.messageHandler[sendingId]
      logFunc(...logArgs)
      func(obj)
    }

    const responseTimeout = this._createTimeout(
      err => saveEnding(reject, err, this.logger.error, err.message),
      'response timed out'
    )

    const handler = message => {
      responseTimeout.cancel()
      saveEnding(resolve, message.body, this.logger.debug, 'received:', `<${message.id}>`, message.body)
    }

    const saveReject = (err, message) => {
      responseTimeout.cancel()
      saveEnding(reject, err, this.logger.error, message)
    }

    this.messageHandler[sendingId] = handler
    this.ws.prependOnceListener('close', () => saveReject(new TimeoutError('remote socket closed'), 'requestResponse close'))
    this.ws.prependOnceListener('unexpected-response', err => saveReject(err, 'requestResponse unexpected-response'))
    this.ws.prependOnceListener('error', err => saveReject(err, 'requestResponse error'))

    this.logger.debug('sending:', `<${sendingId}>`, request)
    this.ws.send(wsmessages.createRawMessage(sendingId, request), err => err
      ? saveReject(err, 'sending error')
      : this.logger.debug('sending done')
    )
  }

  stop () {
    return new Promise((resolve) => this._stopSync(resolve))
  }

  _stopSync (resolve = () => { }) {
    this.logger.debug('closing connection...')
    if (this.ws === null) return resolve()
    try {
      this.ws.close()
      this.logger.info('stopped')
    } catch (err) {
      this.logger.error('error stopping:', err.message)
    }
    this._reset(resolve)
  }

  _createTimeout (reject, message) {
    this.logger.debug('creating timeout:', message)
    const timeout = setTimeout(() => {
      this.logger.debug('timed out:', message)
      reject(new TimeoutError(message))
    }, this.wsconfig.timeout)

    const cancel = () => {
      this.logger.debug('cancel time:', message)
      clearTimeout(timeout)
    }
    return { cancel }
  }

  _clearListeners (all = false) {
    if (this.ws != null) {
      this.ws.removeAllListeners('open')
      this.ws.removeAllListeners('close')
      this.ws.removeAllListeners('error')
      this.ws.removeAllListeners('unexpected-response')
      this.ws.removeAllListeners('close')
      if (all) {
        this.ws.removeAllListeners('message')
      }
    }
  }
}

module.exports = WSClient
