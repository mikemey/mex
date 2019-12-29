const should = require('chai').should()
const util = require('util')
const setTimeoutPromise = util.promisify(setTimeout)

const { SocketClient } = require('../connectors')
const ServerInterceptor = require('./interceptor/soserver-interceptor')

describe.only('Socket client', () => {
  const address = 'ipc:///tmp/mextest'
  const authToken = '12345678901234567890'
  const timeout = 250
  const defTestConfig = { address, authToken, timeout }
  const defaultClient = (config = defTestConfig, name = 'test-client') => SocketClient(Object.assign({}, config), name)

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
    const mockServer = ServerInterceptor(address, authToken)
    const sockClient = defaultClient()

    beforeEach(() => mockServer.start())
    afterEach(() => Promise.all([sockClient.stop(), mockServer.stop()]))

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
    const clientError = (client, expectedMessage) => {
      return client.send(message(`message causing: ${expectedMessage}`))
        .then(() => { throw new Error('expected Error when invoking client.send()') })
        .catch(err => err.message.should.equal(expectedMessage))
    }

    it('uses configured authorization key', () => sockClient.send(message(0))
      .then(res => {
        res.should.deep.equal(mockServer.defaultResponse)
        mockServer.received.authTokens.should.deep.equal([
          { mechanism: 'PLAIN', user: 'user', authToken }
        ])
      })
    )

    it('can resend after stopping', () => sockClient.send(message('i_1'))
      .then(() => sockClient.send(message('i_2')))
      .then(() => sockClient.stop())
      .then(() => sockClient.send(message('i_3')))
      .then(() => mockServer.received.messages.should.have.length(3))
    )

    it('wrong address throws error when sending', () => {
      const wrongClient = defaultClient({ address: 'ipc:///tmp/unknown', authToken, timeout }, 'wrong-address-client')
      return expectDisconnected(wrongClient)
        .then(wrongClient.stop)
    })

    it('wrong authToken throws error when starting', () => {
      const wrongClient = defaultClient(
        { address, authToken: 'YmxhYmFsYmFibGFiYWxiYWwK', timeout }, 'wrong-auth-client'
      )
      return clientError(wrongClient, 'Authentication failure')
    })

    it('resend after server restart', () => sockClient.send(message('s 1'))
      .then(() => {
        mockServer.received.messages.should.deep.equal([message('s 1')])
        return mockServer.stop()
      })
      .then(() => mockServer.start())
      .then(canSendMessages)
    )

    it('stopped server - Disconnect Error - can resend', () => {
      mockServer.stop()
      return expectDisconnected(sockClient)
        .then(() => mockServer.start())
        .then(canSendMessages)
    })

    it('response times out - does not accept old message', () => {
      mockServer.interceptors.responsePromise = () => setTimeoutPromise(timeout + 5)
        .then(() => { return { delayed: 'response' } })
      return expectDisconnected(sockClient)
        .then(canSendMessages)
    })

    describe('multiple clients', () => {
      const client2 = defaultClient(defTestConfig, 'client2')
      const client3 = defaultClient(defTestConfig, 'client3')

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
          .then(() => sockClient.stop())
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
