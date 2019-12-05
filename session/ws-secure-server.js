const Joi = require('@hapi/joi')

const { WSServer, WSClient } = require('../connectors')

const {
  wsmessages: { withAction, OK_STATUS, NOK_STATUS },
  Validator, LogTrait
} = require('../utils')

// const { dbconnection, wsmessages, errors: { ClientError }, Validator } = require('../utils')
// const { createAccessService, KW_LOGIN, KW_REGISTER, KW_VERIFY, KW_REVOKE } = require('./session-access')

// const configSchema = Joi.object({
//   jwtkey: Validator.secretToken('jwtkey'),
//   wsserver: Joi.object().required(),
//   db: Joi.object({
//     url: Joi.string().required(),
//     name: Joi.string().required()
//   }).required()
// })

// const requestCheck = Validator.createCheck(fullSchema, {
//   onError: () => { throw new ClientError('invalid request', wsmessages.error('invalid request'), false) },
//   onWarning: (msg, origin) => { throw new ClientError(msg, wsmessages.withAction(origin.action).nok(msg)) }
// })

const verifyMessages = withAction('verify')

class WSSecureServer extends WSServer {
  constructor (config) {
    console.log('WSSecureServer calling super(config)')
    const serverConfig = Object.assign({}, config)
    const sessionClientConfig = serverConfig.sessionService
    delete serverConfig.sessionService
    super(serverConfig)

    this.sessionClient = new WSClient(sessionClientConfig)
  }

  stop () {
    return this.sessionClient.stop().then(super.stop())
  }

  async received (message) {
    const verification = await this.sessionClient.send(verifyMessages.build({ jwt: message.jwt }))
    switch (verification.status) {
      case OK_STATUS: {
        return this.secureReceived(message)
      }
      default: return verification
    }
  }

  secureReceived (message) { return Promise.resolve(message) }
}

module.exports = WSSecureServer
