const WebSocket = require('ws')
const Joi = require('@hapi/joi')

const { Logger, Validator, wsmessages } = require('../utils')

const configSchema = Joi.object({
  url: Joi.string().uri().required(),
  authToken: Validator.secretToken('authToken'),
  timeout: Joi.number().min(20).max(60000).required(),
  pingInterval: Joi.number().min(20).max(100000).required()
})

const WS_WAIT_RETRIES = 5
const getHrState = socketState => {
  switch (socketState) {
    case WebSocket.CLOSED: return 'CLOSED'
    case WebSocket.CLOSING: return 'CLOSING'
    case WebSocket.CONNECTING: return 'CONNECTING'
    case WebSocket.OPEN: return 'OPEN'
  }
}

const Waiter = (ws, reject) => {
  let retries = WS_WAIT_RETRIES

  const checkStatus = (desiredState, resolve) => {
    if (ws.readyState === desiredState) {
      return resolve()
    }
    retries--
    if (retries > 0) {
      setTimeout(() => checkStatus(desiredState, resolve), 100)
    } else {
      reject(Error(`waiting for socket state ${desiredState} (${getHrState(desiredState)}) exceeded retries (max: ${WS_WAIT_RETRIES})`))
    }
  }
  return checkStatus
}

const Heartbeat = (logger, pingInterval) => {
  const data = {
    pingId: null,
    pingTimeout: null
  }

  const start = ws => {
    if (data.pingId !== null) { throw Error('previous ping-timeout not cancelled!') }
    data.pingId = wsmessages.randomMessageId()

    ws.addListener('close', cancel)
    ws.addListener('unexpected-response', cancel)
    ws.addListener('error', cancel)

    logger.debug('starting heartbeat:', data.pingId)
    data.pingTimeout = setInterval(() => {
      logger.debug('sending heartbeat:', data.pingId)
      ws.ping()
    }, pingInterval)
  }

  const cancel = () => {
    if (data.pingId !== null) {
      logger.debug('clearing heartbeat:', data.pingId)
      clearInterval(data.pingTimeout)
      data.pingId = null
    }
  }

  return { start, cancel }
}

const clearListeners = (ws, listeners) => {
  if (ws !== null) {
    for (const { event, listener } of listeners) {
      ws.removeEventListener(event, listener)
    }
  }
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
    this.ws = null
    this.wsconfig = config
    this.heartbeat = Heartbeat(this.logger, config.pingInterval)
    this._reset()
  }

  _reset () {
    this.logger.debug('resetting state')
    this.heartbeat.cancel()
    if (this.ws !== null) { this.ws.removeAllListeners() }

    this.ws = null
    this.headers = { 'X-AUTH-TOKEN': this.wsconfig.authToken }
    this.messageHandler = new Map()
    this.topicHandler = new Map()
  }

  _openWebsocket (resolve, reject) {
    this.logger.info('connecting to:', this.wsconfig.url)
    const registeredListeners = []

    const saveEnding = (endCb, ...args) => {
      clearListeners(this.ws, registeredListeners)
      this.logger.debug(...args)
      endCb()
    }

    const connectTimeout = this._createTimeout(
      err => saveEnding(() => reject(err), 'connecting timed out'), 'connecting'
    )

    this.ws = new WebSocket(this.wsconfig.url, { headers: this.headers })
    const prependOnceListener = (event, listener) => {
      this.ws.prependOnceListener(event, listener)
      registeredListeners.push({ event, listener })
    }

    prependOnceListener('open', () => {
      connectTimeout.cancel()
      this.heartbeat.start(this.ws)
      saveEnding(resolve, 'connection established')
    })

    this.ws.addListener('message', raw => {
      const message = wsmessages.extractMessage(raw)
      const handler = message.isBroadcast
        ? this.topicHandler.get(message.topic)
        : this.messageHandler.get(message.id)
      const errorId = message.isBroadcast ? message.topic : message.id
      return handler ? handler(message) : this.logger.info('dropping received:', `<${errorId}>`)
    })

    const closedown = error => {
      connectTimeout.cancel()
      saveEnding(() => reject(error), 'connection error:', error.message)
    }
    prependOnceListener('close', closedown)
    prependOnceListener('error', closedown)
    prependOnceListener('unexpected-response', () => closedown(Error('unexpected-response')))
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
      this.stop()
      throw sendError
    })
  }

  subscribe (topic, callback = (topic, message) => { }) {
    const addTopicCallback = resolve => subscriptionResponse => {
      if (subscriptionResponse.status === wsmessages.OK_STATUS) {
        this.topicHandler.set(topic, message => {
          this.logger.debug('received:', `<${topic}>`, message.body)
          callback(topic, message.body)
        })
      }
      resolve(subscriptionResponse)
    }
    return this._internalSend(topicSubscription(topic), addTopicCallback)
  }

  unsubscribe (...topics) {
    return Promise.all(topics.map(topic => this
      ._internalSend(topicUnsubscribe(topic))
      .finally(() => this.topicHandler.delete(topic))
    ))
  }

  _requestResponse (request, resolve, reject) {
    const sendingId = wsmessages.randomMessageId()
    const registeredListeners = []

    const saveEnding = (func, obj, logFunc, ...logArgs) => {
      clearListeners(this.ws, registeredListeners)
      this.messageHandler.delete(sendingId)
      logFunc(...logArgs)
      func(obj)
    }

    const responseTimeout = this._createTimeout(
      err => saveEnding(reject, err, this.logger.debug, err.message), 'response'
    )

    const saveReject = (err, message) => {
      responseTimeout.cancel()
      saveEnding(reject, err, this.logger.error, message)
    }

    this.messageHandler.set(sendingId, message => {
      responseTimeout.cancel()
      saveEnding(resolve, message.body, this.logger.debug, 'received:', `<${message.id}>`, message.body)
    })

    const prependOnceListener = (event, listener) => {
      this.ws.prependOnceListener(event, listener)
      registeredListeners.push({ event, listener })
    }
    prependOnceListener('close', () => saveReject(new TimeoutError('remote socket closed'), 'requestResponse close'))
    prependOnceListener('unexpected-response', err => saveReject(err, 'requestResponse unexpected-response'))
    prependOnceListener('error', err => saveReject(err, 'requestResponse error'))

    this.logger.debug('sending:', `<${sendingId}>`, request)
    this.ws.send(wsmessages.createRawMessage(sendingId, request), err => err
      ? saveReject(err, 'sending error')
      : this.logger.debug('sending done')
    )
  }

  stop () {
    this.logger.debug('closing connection...')
    if (this.ws === null) return
    try {
      this.ws.close()
      this.logger.info('stopped')
    } catch (err) {
      this.logger.error('error stopping:', err.message)
    }
    this._reset()
  }

  _createTimeout (reject, name) {
    this.logger.debug('creating timeout:', name)
    const timeout = setTimeout(() => {
      this.logger.debug('timed out:', name)
      reject(new TimeoutError(`${name} timed out`))
    }, this.wsconfig.timeout)

    const cancel = () => {
      this.logger.debug('cancel timeout:', name)
      clearTimeout(timeout)
    }
    return { cancel }
  }
}

module.exports = WSClient
