const WebSocket = require('ws')

const testToken = 'test-token'
class TestClient {
  constructor () {
    this.debug = false
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

  debugLog (message, err) {
    if (this.debug) {
      console.log(`[TEST-CLIENT] ${message}`)
      if (err) { console.log(err) }
    }
  }

  connect (headers = this.headers, path = this.config.wss.path) {
    return new Promise((resolve, reject) => {
      const port = this.config.wss.port
      const url = `ws://localhost:${port}${path}`
      this.ws = new WebSocket(url, { headers })

      this.ws.on('open', resolve)
      this.ws.on('error', reject)
      // this.ws.on('close', () => { this.ws = null })
    })
  }

  send (request) {
    if (!this.ws) throw Error('not initialized')
    return new Promise((resolve, reject) => {
      this.ws.on('message', raw => {
        this.debugLog(`on message: [${raw}]`)
        resolve(JSON.parse(raw))
      })
      this.ws.on('close', (code, reason) => {
        this.debugLog('on close')
        resolve()
      })
      this.ws.on('error', err => {
        this.debugLog('on error', err)
        reject(err)
      })
      this.debugLog('sending:', request)
      const message = JSON.stringify(request)
      this.ws.send(message, err => {
        if (err) {
          this.debugLog('sending error:', err)
          reject(err)
        } else {
          this.debugLog('sending done')
        }
      })
    })
  }

  close () {
    if (this.isOpen()) { this.ws.close() }
    if (this.ws) { this.ws = null }
  }

  isOpen () {
    return (this.ws) && this.ws.readyState === WebSocket.OPEN
  }
}

module.exports = TestClient
