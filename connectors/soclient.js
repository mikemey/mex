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

  const logger = Logger(logCategory)
  const client = new Dealer()
  const messageHandlers = new Map()

  const start = async () => {
    client.plainUsername = connectionUser
    client.plainPassword = config.authToken

    // client.events.on('handshake:error:auth', data => {
    //   logger.error('auth error:', data.address, data.error)
    // })
    logger.info('connecting to:', config.address)
    await client.connect(config.address)
    listenLoop()
  }

  const listenLoop = async () => {
    for await (const rawmessage of client) {
      const [mid, data] = parseMessage(rawmessage)
      logger.debug('received:', mid, data)
      messageHandlers.get(mid).resolve(data)
      messageHandlers.delete(mid)
    }
  }

  const send = data => {
    const message = createMessage(data)
    const [mid, rawdata] = message
    return new Promise((resolve, reject) => {
      logger.debug('sending:', mid, rawdata)
      messageHandlers.set(mid, { resolve, reject })
      return client.send(message)
    }).catch(err => {
      logger.error('sending error:', mid, err.message, err)
      messageHandlers.get(mid).reject(new Error('disconnected'))
      messageHandlers.delete(mid)
    })
  }

  const stop = () => client.close()

  return { start, send, stop }
}

module.exports = SocketClient
