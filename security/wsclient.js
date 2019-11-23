const WebSocket = require('ws')
const Joi = require('@hapi/joi')

const util = require('util')
const setImmediatePromise = util.promisify(setImmediate)

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
    this.checkInterval = null
    this.headers = { 'X-AUTH-TOKEN': this.wsconfig.authToken }
  }

  start () {
    validateConfig(this.wsconfig)
    // this.checkInterval = setInterval(() => {
    //   console.log(`${__filename}`, new Date())
    // }, 1)
    // this.checkInterval.unref()
    return setImmediatePromise().then(() => this.checkConnection())
  }

  checkConnection () {
    if (this.isReady()) { return }
    this.connect()
  }

  connect () {
    this.log(`connecting to: ${this.wsconfig.url}`)
    this.ws = new WebSocket(this.wsconfig.url, { headers: this.headers })
    this.ws.on('open', () => this.log('connection established'))
    this.ws.on('close', (code, reason) => {
      this.log(`connection closed [${code}]: ${reason}`)
      this.ws = null
    })
    this.ws.on('error', error => {
      this.log('connection error', error)
      this.ws = null
    })
  }

  send () {
    return new Promise((resolve, reject) => {
      if (!this.checkInterval) { reject(Error('not started')) }
      resolve()
    })
  }

  stop () {
    if (this.checkInterval) { clearInterval(this.checkInterval) }
    if (this.isReady()) {
      this.log('closing connection')
      this.ws.close()
    }
    this.ws = null
    this.checkInterval = null
  }

  isReady () { return this.ws !== null && this.ws.readyState === WebSocket.OPEN }
}

module.exports = WSClient
