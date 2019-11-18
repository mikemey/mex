const WebSocket = require('ws')

const testToken = 'test-token'
class TestClient {
  constructor (debug = false) {
    this.debug = debug
    this.ws = null
    this.config = {
      wss: {
        path: '/test',
        port: 12001,
        authorizedKeys: [testToken]
      }
    }
    this.headers = { 'X-AUTH-TOKEN': testToken }
  }

  debugLog (message) {
    if (this.debug) console.log(`[TEST-CLIENT] ${message}`)
  }

  connect (headers = this.headers, path = this.config.wss.path) {
    return new Promise((resolve, reject) => {
      const port = this.config.wss.port
      const url = `ws://localhost:${port}${path}`
      this.ws = new WebSocket(url, { headers })
      this.ws.on('open', resolve)
      this.ws.on('error', reject)
    })
  }

  send (request) {
    if (!this.ws) throw Error('not initialized')
    return new Promise((resolve, reject) => {
      this.ws.on('message', raw => {
        this.debugLog(`received: [${raw}]`)
        resolve(JSON.parse(raw))
      })
      const message = JSON.stringify(request)
      this.ws.send(message, err => {
        if (err) {
          this.debugLog(`error: [${err}]`)
          reject(err)
        }
      })
    })
  }

  close () {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

module.exports = TestClient
