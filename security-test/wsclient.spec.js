const should = require('chai').should()
const util = require('util')
const setTimeoutPromise = util.promisify(setTimeout)

const { WSClient } = require('../security')
const { TestServer } = require('../testtools')

describe('Websocket client', () => {
  const port = 12345
  const path = 'testwsclient'
  const authToken = '12345678901234567890'
  const sendTimeout = 230
  const defConfig = { url: `ws://localhost:${port}/${path}`, authToken, sendTimeout }
  const defaultClient = (config = defConfig) => new WSClient(Object.assign({}, config))

  describe('configuration checks', () => {
    const checkConfigError = (errconfig, expectedMessage) => {
      try {
        defaultClient(errconfig)
        should.fail('expected error')
      } catch (err) {
        err.message.should.equal(expectedMessage)
      }
    }

    const deleteKey = (deleteField, expectedMessage) => {
      const errconfig = Object.assign({}, defConfig)
      delete errconfig[deleteField]
      return checkConfigError(errconfig, expectedMessage)
    }

    const withKey = (overwrite, expectedMessage) => {
      const errconfig = Object.assign({}, defConfig, overwrite)
      return checkConfigError(errconfig, expectedMessage)
    }

    it('url required', () => deleteKey('url', '"url" is required'))
    it('url invalid', () => withKey({ url: 'something-else' }, '"url" must be a valid uri'))
    it('authToken required', () => deleteKey('authToken', '"authToken" is required'))
    it('authToken too short', () => withKey({ authToken: '1234567890123456789' }, '"authToken" too short'))
    it('sendTimeout required', () => deleteKey('sendTimeout', '"sendTimeout" is required'))
    it('sendTimeout minimum', () => withKey({ sendTimeout: 19 }, '"sendTimeout" must be larger than or equal to 20'))
    it('sendTimeout maximum', () => withKey({ sendTimeout: 2001 }, '"sendTimeout" must be less than or equal to 2000'))
    it('sendTimeout not a number', () => withKey({ sendTimeout: '123x' }, '"sendTimeout" must be a number'))
  })

  describe('connection to server', () => {
    const mockServer = new TestServer(port, path)
    const wsclient = defaultClient()

    beforeEach(() => mockServer.start())
    afterEach(() => wsclient.stop().then(() => mockServer.stop()))

    const delay = ms => () => new Promise(resolve => setTimeout(resolve, ms))
    const message = data => { return { mid: data } }

    const canSendResponse = () => {
      mockServer.resetInterceptors()
      return wsclient.send(message('hello'))
        .then(response => {
          response.should.deep.equal(mockServer.defaultResponse)
          mockServer.received.messages.should.deep.include(message('hello'))
        })
    }

    const expectDisconnected = client => clientError(client, 'disconnected')
    const expectTimeout = client => clientError(client, 'response timed out')
    const clientError = (client, expectedMessage) => {
      return client.send(message(expectedMessage))
        .then(() => { throw new Error('expected Error when invoking client.send()') })
        .catch(err => err.message.should.equal(expectedMessage))
    }

    it('wrong URL throws Error when sending', () => expectDisconnected(
      defaultClient({ url: `ws://localhost:${port + 1}/${path}`, authToken, sendTimeout })
    ))

    it('uses configured authorization key', () => wsclient.send(message(0))
      .then(() => mockServer.received.authTokens.should.include(authToken))
    )

    it('can resend after stopping', () => wsclient.send(message('i_1'))
      .then(() => wsclient.send(message('i_2')))
      .then(() => wsclient.stop()).then(delay(10))
      .then(() => wsclient.send(message('i_3')))
      .then(() => mockServer.received.messages.should.have.length(3))
    )

    it('resend after server restart', () => wsclient.send(message('s 1'))
      .then(() => {
        mockServer.received.messages.should.deep.equal([message('s 1')])
        return mockServer.stop()
      }).then(delay(10))
      .then(() => mockServer.start())
      .then(canSendResponse)
    )

    it('stopped server - throws Error and tries to reconnect', () => mockServer.stop()
      .then(() => expectDisconnected(wsclient))
      .then(() => mockServer.start())
      .then(canSendResponse)
    )

    it('response times out - throws Error and tries to reconnect', () => {
      wsclient.wsconfig.sendTimeout = 5
      mockServer.interceptors.responsePromise = setTimeoutPromise(20).then(() => { return { not: 'this' } })
      return expectTimeout(wsclient)
        .then(() => {
          mockServer.resetInterceptors()
          wsclient.wsconfig.sendTimeout = defConfig.sendTimeout
        })
        .then(canSendResponse)
    })

    it('multiple clients can connect/reconnect', () => {
      const client2 = defaultClient()
      const client3 = defaultClient()
      const client1Send = () => wsclient.send(message(1))
      const client2Send = () => client2.send(message(2))
      const client3Send = () => client3.send(message(3))
      return client1Send().then(client3Send)
        .then(() => wsclient.stop()).then(delay(10))
        .then(client2Send).then(client2Send).then(client1Send)
        .then(() => mockServer.received.messages.should.deep.equal(
          [message(1), message(3), message(2), message(2), message(1)]
        ))
    })

    const checkForTimeout = client => expectTimeout(client).then(() => {
      mockServer.resetInterceptors()
    }).then(canSendResponse)

    it('recovers from remote socket.close before response', () => {
      mockServer.interceptors.beforeResponse = ws => {
        ws.close()
        throw new Error('before response error')
      }
      return checkForTimeout(wsclient)
    })

    it('recovers from remote socket.end before response', () => {
      mockServer.interceptors.beforeResponse = ws => {
        ws.close()
        throw new Error('before response error')
      }
      return checkForTimeout(wsclient)
    })

    it('recovers from remote socket.close after response', () => {
      mockServer.interceptors.afterResponse = ws => ws.close()
      return checkForTimeout(wsclient)
    })

    it('clean resend after socket.end after response', () => {
      mockServer.interceptors.afterResponse = ws => ws.end()
      return wsclient.send(message('works out'))
        .then(() => mockServer.resetInterceptors())
        .then(canSendResponse)
    })
  })
})
