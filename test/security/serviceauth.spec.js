const should = require('should')
const WebSocket = require('ws')

const ServiceAuth = require('../../src/security/serviceauth')

const testOptions = {
  path: '/somep',
  port: 12000,
  authorizedKeys: ['test-token']
}
const testUrl = (path = testOptions.path) => `ws://localhost:${testOptions.port}${path}`

describe.only('Service authorization', () => {
  const serviceauth = new ServiceAuth(testOptions)
  before(() => serviceauth.start())
  after(() => serviceauth.stop())

  describe('should allow WS connection', () => {
    it('when correct access token', () => new Promise((resolve, reject) => {
      const ws = new WebSocket(testUrl(), {
        headers: { 'X-AUTH-TOKEN': testOptions.authorizedKeys[0] }
      })
      ws.on('open', () => {
        ws.close()
        resolve()
      })
      ws.on('close', () => reject(Error('expected websocket to be open')))
    }))
  })

  describe('should disallow WS connection', () => {
    const expectCloseWs = (headers, path) => new Promise((resolve, reject) => {
      const ws = new WebSocket(testUrl(path), { headers })
      ws.on('open', () => {
        ws.close()
        reject(Error('expected websocket to close'))
      })
      ws.on('error', err => {
        err.message.should.equal('socket hang up')
        resolve()
      })
    })

    it('when no access token', () => expectCloseWs({}))
    it('when no invalid token', () => expectCloseWs(
      { 'X-AUTH-TOKEN': testOptions.authorizedKeys[0] + 'x' }
    ))

    it('when incorrect path', () => expectCloseWs(
      { 'X-AUTH-TOKEN': testOptions.authorizedKeys[0] },
      testOptions.path + 'x'
    ))
  })

  describe('service start error', () => {
    it('when already running', () => serviceauth.start()
      .then(() => should.fail('expected error'))
      .catch(err => {
        err.message.should.equal(`already started on port ${testOptions.port}`)
      })
    )
  })
})
