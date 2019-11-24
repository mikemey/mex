const WebSocket = require('ws')

const { LogTrait } = require('../utils')
const testToken = 'test-token'

class TestClient extends LogTrait {
  constructor () {
    super()
    this.ws = null
    this.wssconfig = {
      path: '/test',
      port: 12001,
      authorizedTokens: [testToken]
    }
    this.testconfig = {
      headers: { 'X-AUTH-TOKEN': testToken },
      afterSendAction: null
    }
  }

  getWssConfig () {
    return { ...this.wssconfig }
  }

  connect (wssConfigOverride, clientConfigOverride) {
    const connectConfig = Object.assign({}, this.wssconfig, wssConfigOverride)
    const clientConfig = Object.assign({}, this.testconfig, clientConfigOverride)

    return new Promise((resolve, reject) => {
      const url = `ws://localhost:${connectConfig.port}${connectConfig.path}`
      this.log(`connecting to ${url}`)
      this.ws = new WebSocket(url, { headers: clientConfig.headers })
      this.ws.afterSendAction = clientConfig.afterSendAction

      this.ws.on('open', () => {
        this.log('connected')
        resolve()
      })
      this.ws.on('error', err => {
        this.log('error:', err)
        reject(err)
      })
    })
  }

  send (request) {
    if (this.ws === null) throw Error('not initialized')
    return new Promise((resolve, reject) => {
      this.ws.on('message', raw => {
        this.log(`on message: [${raw}]`)
        resolve(JSON.parse(raw))
      })
      this.ws.on('close', (code, reason) => {
        this.log(`on close: ${code} [${reason}]`)
        resolve()
      })
      this.ws.on('error', err => {
        this.log('on error', err)
        reject(err)
      })
      this.log('sending:', request)
      const message = JSON.stringify(request)
      this.ws.send(message, err => {
        if (err) {
          this.log('sending error:', err)
          reject(err)
        } else {
          this.log('sending done')
        }
      })
      this.log('executing after send action')
      if (this.ws.afterSendAction) { this.ws.afterSendAction(this.ws) }
    })
  }

  close () {
    if (this.isOpen()) { this.ws.close() }
    if (this.ws) { this.ws = null }
  }

  isOpen () {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

module.exports = TestClient
