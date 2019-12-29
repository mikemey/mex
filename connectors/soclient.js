const { Dealer } = require('zeromq')
const Joi = require('@hapi/joi')

const { Logger, Validator, wsmessages: { createMessage, parseMessage } } = require('../utils')
const connectionUser = 'user'

const configSchema = Joi.object({
  address: Joi.string().uri().required(),
  authToken: Validator.secretToken('authToken'),
  timeout: Joi.number().min(20).max(60000).required()
})

const SocketClient = (config, logCategory) => {
  Validator.oneTimeValidation(configSchema, config)
  if (!logCategory) { throw Error('logCategory required') }

  const clientConfig = {
    connectTimeout: config.timeout,
    sendTimeout: config.timeout,
    receiveTimeout: config.timeout,
    linger: 0
  }

  let client = null
  const logger = Logger(logCategory)
  const messageHandler = new Map()

  const start = () => {
    client = new Dealer(clientConfig)
    client.events.on('handshake:error:auth', ({ error }) => {
      logger.info('authentication error:', error.message)
      stop(error)
    })

    client.plainUsername = connectionUser
    client.plainPassword = config.authToken

    logger.info('connecting to:', config.address)
    client.connect(config.address)
    listenLoop()
  }

  const listenLoop = async () => {
    try {
      logger.debug('start listen-loop')
      for await (const rawmessage of client) {
        const [mid, data] = parseMessage(rawmessage)
        logger.debug('received:', mid, data)
        messageHandler.get(mid).resolve(data)
        messageHandler.delete(mid)
      }
    } catch (err) {
      logger.info('listening error:', err.message)
      stop(Error('disconnected'))
    }
  }

  const send = data => {
    if (client === null) { start() }
    return new Promise((resolve, reject) => {
      const message = createMessage(data)
      const [mid, rawdata] = message
      logger.debug('sending:', mid, rawdata)

      messageHandler.set(mid, { resolve, reject })
      client.send(message)
        .catch(err => {
          logger.info('sending error:', mid, err.message)
          stop(err)
        })
    })
  }

  const stop = error => {
    if (error) {
      for (const [mid, handler] of messageHandler) {
        logger.debug('rejecting message handler', mid)
        handler.reject(error)
        messageHandler.delete(mid)
      }
    }
    if (client) {
      try {
        client.close()
        logger.debug('socket closed')
      } catch (err) { /* ignore closing error */ }
    }
    client = null
    logger.debug('stopped')
  }

  return { send, stop }
}

module.exports = SocketClient
