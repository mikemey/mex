const uws = require('uWebSockets.js')
const Joi = require('@hapi/joi')

const { Logger, Validator, wsmessages, randomHash } = require('../utils')

const configSchema = Joi.object({
  port: Joi.number().port().required(),
  path: Validator.path,
  authTokens: Joi.array().items(Validator.secretToken('authTokens')).required()
})

const ClientSocket = (ws, logger) => {
  const send = message => {
    try { return ws.send(message) } catch (err) {
      logger.error(err)
      return false
    }
  }

  const end = () => {
    try { return ws.end() } catch (err) {
      logger.error('error while closing:', err)
    }
  }

  const getBufferedAmount = () => {
    try { return ws.getBufferedAmount() } catch (err) {
      logger.error('error getting buffered amount:', err.message)
      return 0
    }
  }

  return { ws, logger, send, end, getBufferedAmount }
}

const SUBSCRIBE_ACT = 'subscribe'
const UNSUBSCRIBE_ACT = 'unsubscribe'

const submsgs = wsmessages.withAction(SUBSCRIBE_ACT)
const topicSubscriptionOK = submsgs.ok()
const topicSubscriptionNOK = submsgs.nok()

const unsubscribeOK = wsmessages.withAction(UNSUBSCRIBE_ACT).ok()

const isInvalid = topic => topic.toString().includes('{')

const removeSocketFromList = (socketList, ws) => {
  const csIndex = socketList.findIndex(c => c.ws === ws)
  if (csIndex >= 0) {
    return socketList.splice(csIndex, 1)[0]
  }
  return false
}

class WSServer {
  constructor (config) {
    Validator.oneTimeValidation(configSchema, config)

    this.listenSocken = null
    this.config = config
    this.clientSockets = []
    this.topicSubscriptions = new Map()
    this.logger = Logger(this.constructor.name)
  }

  _createClientSocket (ws) {
    const clientSocket = ClientSocket(ws, this.logger.childLogger(randomHash()))
    this.clientSockets.push(clientSocket)
    return clientSocket
  }

  _getClientSocket (ws) {
    const cs = this.clientSockets.find(c => c.ws === ws)
    if (!cs) { throw new Error('ws not found!') }
    return cs
  }

  _removeClientSocket (ws) {
    for (const topicHandler of this.topicSubscriptions.values()) {
      removeSocketFromList(topicHandler, ws)
    }
    return removeSocketFromList(this.clientSockets, ws)
  }

  start () {
    return new Promise((resolve, reject) => {
      uws.App({}).ws(this.config.path, {
        maxPayloadLength: 4 * 1024,
        open: (ws, req) => {
          const clientSocket = this._createClientSocket(ws)
          const authToken = req.getHeader('x-auth-token')
          if (!this.config.authTokens.includes(authToken)) {
            clientSocket.logger.error('authentication failed, closing socket')
            return ws.close()
          }
          clientSocket.logger.info('client authentication successful')
        },
        message: (ws, buffer) => this._processMessage(this._getClientSocket(ws), buffer),
        drain: ws => this._getClientSocket(ws).logger.error('socket backpressure:', ws.getBufferedAmount()),
        close: ws => {
          const clientSocket = this._removeClientSocket(ws)
          if (clientSocket) {
            clientSocket.logger.debug('socket closed.')
          }
        }
      }).listen(this.config.port, socket => {
        if (socket) {
          this.logger.info('listening on port', this.config.port)
          this.listenSocket = socket
          resolve()
        } else {
          const msg = `failed to listen on port ${this.config.port}`
          this.logger.error(msg)
          reject(Error(msg))
        }
      })
    })
  }

  stop () {
    if (this.listenSocket) {
      this.logger.debug('shutting down')
      this.clientSockets.forEach(cs => cs.end())
      this.clientSockets = []
      uws.us_listen_socket_close(this.listenSocket)
      this.listenSocket = null
      this.logger.info('stopped')
    } else {
      this.logger.info('already stopped')
    }
  }

  _processMessage (clientSocket, buffer) {
    const incoming = { msg: null, dropConnection: false }
    return new Promise((resolve, reject) => {
      try {
        const raw = String.fromCharCode.apply(null, new Uint8Array(buffer))
        incoming.msg = wsmessages.extractMessage(raw)
        incoming.msg.prettyId = `<${incoming.msg.id}>`
        clientSocket.logger.debug('received:', incoming.msg.prettyId, incoming.msg.body)
        resolve(incoming.msg.body)
      } catch (err) { reject(err) }
    }).then(req => this._internalReceived(clientSocket, req))
      .catch(err => {
        clientSocket.logger.error('processing error:', err)
        incoming.dropConnection = err.keepConnection !== true
        if (err.clientResponse) { return err.clientResponse }
        return wsmessages.error(incoming.msg.body)
      })
      .then(response => {
        clientSocket.logger.debug('responding:', incoming.msg.prettyId, response)
        const message = wsmessages.createRawMessage(incoming.msg.id, response)
        return clientSocket.send(message)
      })
      .catch(err => {
        clientSocket.logger.error('sending error:', err)
        incoming.dropConnection = true
        return false
      })
      .then(sendResultOk => {
        const buffered = clientSocket.getBufferedAmount()
        clientSocket.logger.debug('send result', incoming.msg.prettyId, 'OK:', sendResultOk, ' buffered:', buffered)

        if (!sendResultOk) { this._sendingError(clientSocket, 'send result NOK') }
        if (buffered > 0) { this._sendingError(clientSocket, `buffer not empty: ${buffered}`) }
        if (incoming.dropConnection) { this._sendingError(clientSocket, 'closing connection') }
      })
  }

  _sendingError (clientSocket, message) {
    clientSocket.logger.error(message)
    clientSocket.end()
  }

  offerTopics (...topics) {
    topics.forEach(topic => {
      if (isInvalid(topic)) { throw new Error(`invalid topic name [${topic}]`) }
      this.topicSubscriptions.set(topic, [])
    })
  }

  broadcast (topic, message) {
    const subscriber = this.topicSubscriptions.get(topic)
    if (!subscriber) {
      return Promise.reject(Error(`invalid topic [${topic}]`))
    }
    if (subscriber.length === 0) {
      return Promise.resolve()
    }
    this.logger.debug('broadcasting:', `<${topic}>`, message, ', clients:', subscriber.length)
    const broadcastmsg = wsmessages.createBroadcastMessage(topic, message)
    return Promise.all(subscriber.map(clientSocket => {
      const sendResultOk = clientSocket.send(broadcastmsg)
      if (!sendResultOk) { this._sendingError(clientSocket, 'broadcast result NOK') }
    }))
  }

  _internalReceived (clientSocket, request) {
    if (request.action === SUBSCRIBE_ACT) {
      return Promise.resolve(this._subscribeRequest(clientSocket, request))
    }
    if (request.action === UNSUBSCRIBE_ACT) {
      return Promise.resolve(this._unsubscribeRequest(clientSocket, request))
    }
    return this.received(request)
  }

  _subscribeRequest (clientSocket, request) {
    const subscriber = this.topicSubscriptions.get(request.topic)
    if (!subscriber) {
      clientSocket.logger.error('topic not available:', request.topic)
      return topicSubscriptionNOK
    }
    const clientIx = subscriber.findIndex(subscr => subscr.ws === clientSocket.ws)
    if (clientIx < 0) {
      subscriber.push(clientSocket)
      clientSocket.logger.info('topic:', request.topic, ', subscriptions:', subscriber.length)
    }
    return topicSubscriptionOK
  }

  _unsubscribeRequest (clientSocket, request) {
    const subscriber = this.topicSubscriptions.get(request.topic)
    if (subscriber) {
      const clientIx = subscriber.findIndex(subscr => subscr.ws === clientSocket.ws)
      if (clientIx >= 0) {
        subscriber.splice(clientIx, 1)
        clientSocket.logger.info('topic:', request.topic, ', subscriptions:', subscriber.length)
      }
    }
    return unsubscribeOK
  }

  received (request) { return Promise.resolve(request) }
}

module.exports = WSServer
