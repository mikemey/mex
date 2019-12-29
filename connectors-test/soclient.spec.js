const should = require('chai').should()
const util = require('util')
const setTimeoutPromise = util.promisify(setTimeout)

const { SocketClient } = require('../connectors')
const ServerInterceptor = require('./interceptor/soserver-interceptor')

describe('mex client', () => {
  const address = 'ipc:///tmp/mextest'
  const authToken = '12345678901234567890'
  const timeout = 20
  const defTestConfig = { address, authToken, timeout }
  const defaultClient = (config = defTestConfig) => SocketClient(Object.assign({}, config), 'test-client')

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

    it('address required', () => deleteKey('address', '"address" is required'))
    it('address invalid', () => withKey({ address: 'something-else' }, '"address" must be a valid uri'))
    it('authToken required', () => deleteKey('authToken', '"authToken" is required'))
    it('authToken too short', () => withKey({ authToken: '1234567890123456789' }, '"authToken" too short'))
    it('timeout required', () => deleteKey('timeout', '"timeout" is required'))
    it('timeout minimum', () => withKey({ timeout: 19 }, '"timeout" must be larger than or equal to 20'))
    it('timeout maximum', () => withKey({ timeout: 60001 }, '"timeout" must be less than or equal to 60000'))
    it('timeout not a number', () => withKey({ timeout: '123x' }, '"timeout" must be a number'))
  })

  describe('connection to server', () => {
    const mockServer = ServerInterceptor(address)
    const sockClient = defaultClient()

    beforeEach(() => Promise.all([sockClient.start(), mockServer.start()]))
    afterEach(() => Promise.all([sockClient.stop(), mockServer.stop()]))

    const delay = ms => () => new Promise(resolve => setTimeout(resolve, ms))
    const message = data => { return { mid: data } }

    const canSendMessages = () => {
      mockServer.resetInterceptors()
      return sockClient.send(message('hello'))
        .then(response => {
          response.should.deep.equal(mockServer.defaultResponse)
          mockServer.received.messages.should.deep.include(message('hello'))
        })
    }

    const expectDisconnected = client => clientError(client, 'disconnected')
    const expectTimeout = client => clientError(client, 'response timed out')
    const clientError = (client, expectedMessage) => {
      return client.send(message(`message causing: ${expectedMessage}`))
        .then(() => { throw new Error('expected Error when invoking client.send()') })
        .catch(err => err.message.should.equal(expectedMessage))
    }

    it('wrong address throws Error when sending', () => expectDisconnected(
      defaultClient({ url: 'ipc:///tmp/unknown', authToken, timeout })
    ))

    it.only('uses configured authorization key', () => sockClient.send(message(0))
      .then(res => {
        res.should.deep.equal(mockServer.defaultResponse)
        mockServer.received.authTokens.should.deep.equal([
          { mechanism: 'PLAIN', user: 'user', authToken }
        ])
      })
    )

    it('resend after server restart', () => sockClient.send(message('s 1'))
      .then(() => {
        mockServer.received.messages.should.deep.equal([message('s 1')])
        return mockServer.stop()
      })
      // .then(delay(10))
      .then(() => mockServer.start())
      .then(canSendMessages)
    )

    it('stopped server - Disconnect Error - can resend', () => mockServer.stop()
      .then(() => expectDisconnected(sockClient))
      .then(() => mockServer.start())
      .then(canSendMessages)
    )

    it('response times out - Timeout Error - does not accept old message', () => {
      mockServer.interceptors.responsePromise = () => setTimeoutPromise(timeout + 5)
        .then(() => { return { delayed: 'response' } })
      return expectTimeout(sockClient)
        .then(canSendMessages)
    })

    describe('multiple clients', () => {
      const client2 = defaultClient()
      const client3 = defaultClient()

      afterEach(async () => {
        await client2.stop()
        await client3.stop()
      })

      it('can connect/reconnect', () => {
        const checkAndSend = (client, num) => response => {
          response.should.deep.equal(mockServer.defaultResponse)
          return client.send(message(num))
        }
        const client1Send = checkAndSend(sockClient, 1)
        const client2Send = checkAndSend(client2, 2)
        const client3Send = checkAndSend(client3, 3)
        return sockClient.send(message(1)).then(client3Send)
          .then(() => client2.send(message(2))).then(client2Send).then(client1Send)
          .then(response => {
            response.should.deep.equal(mockServer.defaultResponse)
            mockServer.received.messages.should.deep.equal(
              [message(1), message(3), message(2), message(2), message(1)]
            )
          })
      })
    })
  })
})
