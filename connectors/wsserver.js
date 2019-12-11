const uws = require('uWebSockets.js')
const Joi = require('@hapi/joi')

const { Logger, Validator, wsmessages, randomHash } = require('../utils')

const configSchema = Joi.object({
  port: Joi.number().port().required(),
  path: Validator.path,
  authorizedTokens: Joi.array().items(Validator.secretToken('authorizedToken')).required()
})

const ClientSocket = (ws, logger) => {
  const send = message => {
    try { return ws.send(message) } catch (err) {
      ws.log(err)
      return false
    }
  }
  const end = () => {
    try { return ws.end() } catch (err) { /* ignore closed socket error */ }
  }
  const getBufferedAmount = () => {
    try { return ws.getBufferedAmount() } catch (err) { return 0 }
  }

  return { ws, logger, send, end, getBufferedAmount }
}

const SUBSCRIBE_ACT = 'subscribe'
const submsgs = wsmessages.withAction(SUBSCRIBE_ACT)
const topicSubscriptionOK = submsgs.ok()
const topicSubscriptionNOK = submsgs.nok()

const isInvalid = topic => topic.includes('{')

class WSServer {
  constructor (config) {
    Validator.oneTimeValidation(configSchema, config)

    this.listenSocken = null
    this.config = config
    this.clientSockets = []
    this.topics = {}
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
    const csIndex = this.clientSockets.findIndex(c => c.ws === ws)
    if (csIndex < 0) { throw new Error('ws not found!') }
    return this.clientSockets.splice(csIndex, 1)[0]
  }

  start () {
    return new Promise((resolve, reject) => {
      uws.App({}).ws(this.config.path, {
        maxPayloadLength: 4 * 1024,
        open: (ws, req) => {
          const clientSocket = this._createClientSocket(ws)
          const authToken = req.getHeader('x-auth-token')
          if (!this.config.authorizedTokens.includes(authToken)) {
            clientSocket.logger.error('authorization failed, closing socket')
            return ws.close()
          }
          clientSocket.logger.info('client authorized successful')
        },
        message: (ws, buffer) => this._processMessage(this._getClientSocket(ws), buffer),
        drain: (ws) => this._getClientSocket(ws).logger.error('socket backpressure:', ws.getBufferedAmount()),
        close: (ws, code) => {
          const clientSocket = this._removeClientSocket(ws)
          clientSocket.logger.info('socket closed:', code)
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
    return new Promise(resolve => {
      if (this.listenSocket) {
        this.logger.info('shutting down')
        this.clientSockets.forEach(cs => cs.end())
        this.clientSockets = []
        uws.us_listen_socket_close(this.listenSocket)
        this.listenSocket = null
        this.logger.info('stopped.')
      } else {
        this.logger.info('already stopped')
      }
      resolve()
    })
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
    this._removeClientSocket(clientSocket.ws)
    clientSocket.logger.error(message)
    clientSocket.end()
  }

  offerTopics (...topics) {
    topics.forEach(topic => {
      if (isInvalid(topic)) { throw new Error(`invalid topic name [${topic}]`) }
      this.topics[topic] = []
    })
  }

  broadcast (topic, message) {
    if (isInvalid(topic)) { return Promise.reject(Error(`invalid topic name [${topic}]`)) }
    if (!Object.keys(this.topics).includes(topic)) {
      return Promise.reject(Error(`invalid topic [${topic}]`))
    }
    this.logger.debug('broadcasting:', `<${topic}>`, message)
    const broadcastmsg = wsmessages.createBroadcastMessage(topic, message)
    const messageToClient = clientSocket => Promise.resolve(clientSocket.send(broadcastmsg))
    return Promise.all(this.topics[topic].map(messageToClient))
  }

  _internalReceived (clientSocket, request) {
    if (request.action === SUBSCRIBE_ACT) {
      if (!Object.keys(this.topics).includes(request.topic)) {
        clientSocket.logger.error('topic not available:', request.topic)
        return Promise.resolve(topicSubscriptionNOK)
      }
      clientSocket.logger.info('topic subscription:', request.topic)
      this.topics[request.topic].push(clientSocket)
      return Promise.resolve(topicSubscriptionOK)
    }
    return this.received(request)
  }

  received (request) { return Promise.resolve(request) }
}

module.exports = WSServer
