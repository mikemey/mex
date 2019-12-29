const { Router } = require('zeromq')
const {
  Logger,
  wsmessages: { parseMessageBody, createMessageBody, OK_STATUS }
} = require('../../utils')

const AuthHandler = receivedAuthTokens => {
  const socket = new Router()
  const run = async () => {
    await socket.bind('inproc://zeromq.zap.01')
    for await (const request of socket) {
      const [path, delimiter, version, id] = request
      const [mechanism, user, authToken] = request.slice(7).map(p => p.toString())
      receivedAuthTokens.push({ mechanism, user, authToken })
      const response = [path, delimiter, version, id, '200', 'OK', null, null]
      await socket.send(response)
    }
  }

  run()
  return { close: () => socket.close() }
}

const ServerInterceptor = address => {
  const sockets = {
    authHandler: null,
    server: null
  }

  const logger = Logger('server-mock-interceptor')
  const received = { authTokens: [], messages: [] }
  const defaultResponse = { status: OK_STATUS }
  const defaultInterceptors = { responsePromise: () => Promise.resolve(defaultResponse) }
  const interceptors = { responsePromise: null }

  const resetInterceptors = () => {
    interceptors.responsePromise = defaultInterceptors.responsePromise
  }

  const start = async () => {
    resetInterceptors()
    received.authTokens = []
    received.messages = []

    sockets.authHandler = AuthHandler(received.authTokens)
    sockets.server = new Router()
    sockets.server.plainServer = true
    await sockets.server.bind(address)
    serverLoop()
  }

  const serverLoop = async () => {
    for await (const [path, mid, mbody] of sockets.server) {
      const data = parseMessageBody(mbody)
      logger.debug('received:', data)
      received.messages.push(data)
      const responseData = await interceptors.responsePromise(sockets.server)
      logger.debug('response:', responseData)

      await sockets.server.send([path, mid, createMessageBody(responseData)])
    }
  }

  const stop = () => {
    if (sockets.authHandler) { sockets.authHandler.close() }
    if (sockets.server) { sockets.server.close() }
    sockets.authHandler = null
    sockets.server = null
  }

  return { start, stop, interceptors, resetInterceptors, defaultResponse, received }
}

module.exports = ServerInterceptor
