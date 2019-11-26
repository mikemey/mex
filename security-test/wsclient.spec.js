const should = require('chai').should()
const util = require('util')
const setTimeoutPromise = util.promisify(setTimeout)

const { WSClient } = require('../security')
const WSAuthMock = require('./wsauthMock')

describe.only('Websocket client', () => {
  const port = 12345
  const path = 'testwsclient'
  const authToken = '12345678901234567890'
  const timeout = 250
  const defTestConfig = { url: `ws://localhost:${port}/${path}`, authToken, timeout }
  const defaultClient = (config = defTestConfig) => new WSClient(Object.assign({}, config))

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
      const errconfig = Object.assign({}, defTestConfig)
      delete errconfig[deleteField]
      return checkConfigError(errconfig, expectedMessage)
    }

    const withKey = (overwrite, expectedMessage) => {
      const errconfig = Object.assign({}, defTestConfig, overwrite)
      return checkConfigError(errconfig, expectedMessage)
    }

    it('url required', () => deleteKey('url', '"url" is required'))
    it('url invalid', () => withKey({ url: 'something-else' }, '"url" must be a valid uri'))
    it('authToken required', () => deleteKey('authToken', '"authToken" is required'))
    it('authToken too short', () => withKey({ authToken: '1234567890123456789' }, '"authToken" too short'))
    it('timeout required', () => deleteKey('timeout', '"timeout" is required'))
    it('timeout minimum', () => withKey({ timeout: 19 }, '"timeout" must be larger than or equal to 20'))
    it('timeout maximum', () => withKey({ timeout: 2001 }, '"timeout" must be less than or equal to 2000'))
    it('timeout not a number', () => withKey({ timeout: '123x' }, '"timeout" must be a number'))
  })

  describe('connection to server', () => {
    let mockServer = new WSAuthMock(port, path)
    let wsclient = defaultClient()
    mockServer.debug = true
    wsclient.debug = true

    beforeEach(() => mockServer.start())
    afterEach(() => wsclient.stop().then(() => mockServer.stop()))

    const delay = ms => () => new Promise(resolve => setTimeout(resolve, ms))
    const message = data => { return { mid: data } }

    const canSendMessages = () => {
      mockServer.resetInterceptors()
      return wsclient.send(message('hello'))
        .then(response => {
          response.should.deep.equal(mockServer.defaultResponse)
          mockServer.received.messages.should.deep.include(message('hello'))
        })
    }

    const expectDisconnected = client => clientError(client, 'disconnected')
    const expectTimeout = client => clientError(client, 'response timed out')
    const expectSocketClosed = client => clientError(client, 'remote socket closed')
    const clientError = (client, expectedMessage) => {
      return client.send(message(`message causing: ${expectedMessage}`))
        .then(() => { throw new Error('expected Error when invoking client.send()') })
        .catch(err => err.message.should.equal(expectedMessage))
    }

    it('wrong URL throws Error when sending', () => expectDisconnected(
      defaultClient({ url: `ws://localhost:${port + 1}/${path}`, authToken, timeout })
    ))

    it('uses configured authorization key', () => wsclient.send(message(0))
      .then(res => {
        res.should.deep.equal(mockServer.defaultResponse)
        mockServer.received.authTokens.should.include(authToken)
      })
    )

    it('can resend after stopping', () => wsclient.send(message('i_1'))
      .then(() => wsclient.send(message('i_2')))
      .then(() => wsclient.stop())
      .then(() => wsclient.send(message('i_3')))
      .then(() => mockServer.received.messages.should.have.length(3))
    )

    it('resend after server restart', () => wsclient.send(message('s 1'))
      .then(() => {
        mockServer.received.messages.should.deep.equal([message('s 1')])
        return mockServer.stop()
      }).then(delay(10))
      .then(() => mockServer.start())
      .then(canSendMessages)
    )

    it('stopped server - Disconnect Error - can resend', () => mockServer.stop()
      .then(() => expectDisconnected(wsclient))
      .then(() => mockServer.start())
      .then(canSendMessages)
    )

    it('response times out - Timeout Error - does not accept old message', () => {
      wsclient.wsconfig.timeout = 15
      mockServer.interceptors.responsePromise = () => setTimeoutPromise(20)
        .then(() => { return { delayed: 'response' } })
      return expectTimeout(wsclient)
        .then(() => {
          mockServer.resetInterceptors()
          wsclient.wsconfig.timeout = defTestConfig.timeout
        })
        .then(canSendMessages)
    })

    it('multiple clients can connect/reconnect', () => {
      const client2 = defaultClient()
      const client3 = defaultClient()
      const checkAndSend = (client, num) => (response) => {
        response.should.deep.equal(mockServer.defaultResponse)
        return client.send(message(num))
      }
      const client1Send = checkAndSend(wsclient, 1)
      const client2Send = checkAndSend(client2, 2)
      const client3Send = checkAndSend(client3, 3)
      return wsclient.send(message(1)).then(client3Send)
        .then(() => wsclient.stop())
        .then(() => client2.send(message(2))).then(client2Send).then(client1Send)
        .then(response => {
          response.should.deep.equal(mockServer.defaultResponse)
          mockServer.received.messages.should.deep.equal(
            [message(1), message(3), message(2), message(2), message(1)]
          )
        })
    })

    const checkForTimeout = client => expectSocketClosed(client).then(() => {
      mockServer.resetInterceptors()
    }).then(canSendMessages)

    it('recovers from remote socket.close before response', () => {
      mockServer.interceptors.responsePromise = ws => {
        ws.close()
        mockServer.interceptors.stopProcessing = true
      }
      return checkForTimeout(wsclient)
    })

    it('recovers from remote socket.end before response', () => {
      mockServer.interceptors.responsePromise = ws => {
        ws.end()
        mockServer.interceptors.stopProcessing = true
      }
      return checkForTimeout(wsclient)
    })

    it('recovers from remote socket.close after response', () => {
      mockServer.interceptors.afterResponse = ws => {
        console.log('test closes websocket')
        ws.close()
      }
      return checkForTimeout(wsclient)
    })

    it('clean resend after socket.end after response', () => {
      mockServer.interceptors.afterResponse = ws => {
        console.log('test ends websocket')
        ws.end()
      }
      return wsclient.send(message('works out'))
        .then(() => mockServer.resetInterceptors())
        .then(canSendMessages)
    })
  })
})
