const should = require('chai').should()
const { trand } = require('../testtools')

const { WSAuth, WSClient } = require('../security')
const WSClientMock = require('./wsclientMock')

describe('WebsocketServer authorization', () => {
  const port = 12001
  const path = '/wsauth-test'
  const testToken = 'wsauth-testing-token'

  const authorizedTokens = [testToken, 'another-testing-token', 'one-more-testing-token']
  const wsauthConfig = { port, path, authorizedTokens }
  const wsauth = new WSAuth(wsauthConfig)

  describe('running server', () => {
    const serverReceived = []
    wsauth.received = request => {
      serverReceived.push(request)
      return Promise.resolve(request)
    }
    const clientMock = new WSClientMock(port, path, testToken)

    before(() => wsauth.start())
    after(() => wsauth.stop())
    afterEach(() => clientMock.close())

    describe('should allow WS connection', () => {
      it('when correct access token', () => clientMock.connect()
        .then(() => clientMock.isOpen().should.equal(true, 'socket open'))
      )

      it('multiple WSClients can send/receive', () => {
        const url = `ws://localhost:${port}${path}`
        const timeout = 200
        const client1 = new WSClient({ url, timeout, authToken: authorizedTokens[0] })
        const client2 = new WSClient({ url, timeout, authToken: authorizedTokens[1] })
        const client3 = new WSClient({ url, timeout, authToken: authorizedTokens[2] })

        const send = (client, count) => () => client.send({ count }).then(result => result.should.deep.equal({ count }))
        const stop = client => () => client.stop()
        return Promise.all([
          send(client1, 100)(), send(client2, 10)(), send(client3, 1)()
        ]).then(() => Promise.all([
          client1._isConnected().then(res => res.should.equal(true)),
          client2._isConnected().then(res => res.should.equal(true)),
          client3._isConnected().then(res => res.should.equal(true))
        ])).then(() => Promise.all([
          send(client1, 200)().then(send(client1, 300)).then(stop(client1)).then(send(client1, 100)),
          stop(client2)().then(send(client2, 10)).then(stop(client2)).then(send(client2, 20)).then(send(client2, 30)),
          send(client3, 3)().then(send(client3, 2)).then(send(client3, 1))
        ])).then(() => {
          const actualSum = serverReceived.map(req => req.count).reduce((a, b) => a + b, 0)
          actualSum.should.equal(777)
        }).finally(() => Promise.all([stop(client1)(), stop(client2)(), stop(client3)()]))
      })
    })

    describe('should close WS connection', () => {
      const expectSocketHangup = wssConfigOverride => clientMock.connect(wssConfigOverride)
        .then(() => { throw new Error('expected websocket to close') })
        .catch(err => err.message.should.equal('socket hang up'))
        .finally(() => clientMock.resetInterceptors())

      const expectSocketClosed = request => clientMock.connect()
        .then(() => clientMock.send(request))
        .then(() => clientMock.isOpen().should.equal(false, 'socket closed'))
        .finally(() => clientMock.resetInterceptors())

      it('when no access token', () => {
        clientMock.interceptors.headers = {}
        return expectSocketHangup()
      })

      it('when invalid token', () => {
        clientMock.interceptors.headers = { 'X-AUTH-TOKEN': testToken + 'x' }
        return expectSocketHangup()
      })

      it('when incorrect path', () => expectSocketHangup({ path: wsauthConfig.path + 'x' }))

      it('when payload too large', () => expectSocketClosed({ action: trand.randStr(4 * 1024) }))

      it('when sender closes socket immediately', () => {
        clientMock.interceptors.afterSendAction = ws => ws.close()
        return expectSocketClosed({ msg: 1 })
      })
    })
  })

  describe('server configuration/usage error', () => {
    it('when already running', () => wsauth.start()
      .then(() => wsauth.start())
      .then(() => { throw new Error('expected error') })
      .catch(err => {
        err.message.should.equal(`failed to listen on port ${wsauthConfig.port}`)
      })
      .finally(() => wsauth.stop())
    )

    const allowedConfig = { path: '/test-123', port: 18000, authorizedTokens: ['a-token'] }
    const configWith = (overwrite, expectedMessage) => {
      const errconfig = Object.assign({}, allowedConfig, overwrite)
      return checkConfigError(errconfig, expectedMessage)
    }

    const configWithout = (deleteField, expectedMessage) => {
      const errconfig = Object.assign({}, allowedConfig)
      delete errconfig[deleteField]
      return checkConfigError(errconfig, expectedMessage)
    }

    const checkConfigError = (errconfig, expectedMessage) => {
      try {
        new WSAuth(errconfig).start()
        should.fail('expected error')
      } catch (err) {
        err.message.should.equal(expectedMessage)
      }
    }

    it('path required', () => configWithout('path', '"path" is required'))
    it('path invalid', () => configWith({ path: '12345678901' }, '"path" not valid'))
    it('port required', () => configWithout('port', '"port" is required'))
    it('port not valid', () => configWith({ port: '70123' }, '"port" must be a valid port'))
    it('authorizedTokens required', () => configWithout('authorizedTokens', '"authorizedTokens" is required'))
    it('authorizedTokens not an array', () => configWith({ authorizedTokens: 'lala' }, '"authorizedTokens" must be an array'))
    it('authorizedTokens contains non-string', () =>
      configWith({ authorizedTokens: ['abcdefghijklmnopqrst', 3] }, '"authorizedTokens[1]" must be a string'))
  })

  describe('service implementation error', () => {
    const clientMock = new WSClientMock(port, path, testToken)
    class FailingService extends WSAuth {
      received (_) {
        return Promise.reject(Error('test-error'))
      }
    }

    const failService = new FailingService(wsauthConfig)
    before(() => failService.start())
    after(() => failService.stop())
    beforeEach(() => clientMock.connect())
    afterEach(() => clientMock.close())

    it('should respond with error', () => {
      const request = { action: 'test' }
      return clientMock.send(request)
        .then(result => {
          result.status.should.equal('error')
          result.message.should.deep.equal(request)
        })
    })
  })
})
