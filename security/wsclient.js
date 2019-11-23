const WebSocket = require('ws')
const Joi = require('@hapi/joi')

const { LogTrait } = require('../utils')

const configSchema = Joi.object({
  url: Joi.string().uri().required(),
  authToken: Joi.string().min(20).message('"authToken" too short').required()
})

const validateConfig = config => {
  const validation = configSchema.validate(config)
  if (validation.error) {
    throw new Error(validation.error.message)
  }
}

class WSClient extends LogTrait {
  constructor (config) {
    super()
    this.wsconfig = config
    this.ws = null
    this.headers = { 'X-AUTH-TOKEN': this.wsconfig.authToken }
  }

  start () {
    validateConfig(this.wsconfig)
    return new Promise((resolve, reject) => {
      this.log(`connecting to: ${this.wsconfig.url}`)
      this.ws = new WebSocket(this.wsconfig.url, { headers: this.headers })

      this.ws.on('open', () => {
        this.log('connection established')
        resolve()
      })
      this.ws.on('close', () => {
        this.log('connection closed')
        resolve()
      })
      this.ws.on('error', reject)
    })
  }

  stop () {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.log('closing connection')
        this.ws.close()
      }
      this.ws = null
    }
  }
}

module.exports = WSClient
