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
    afterEach(() => {
      return wsclient.stop()
        .then(() => mockServer.stop())
    })

    const delay = ms => () => new Promise(resolve => setTimeout(resolve, ms))

    it('uses configured authorization key', () => wsclient.send({})
      .then(() => mockServer.received.authTokens.should.include(authToken))
    )

    it('can start/stop', () => wsclient.send({})
      .then(() => wsclient.send({}))
      .then(() => wsclient.stop()).then(delay(10))
      .then(() => wsclient.send({}))
      .then(() => mockServer.received.messages.should.have.length(3))
    )

    it('when sending failed - throws Error and reconnects', () => mockServer.stop()
      .then(() => wsclient.send({}))
      .then(() => { throw new Error('expected error') })
      .catch(err => err.message.should.equal('disconnected'))
      .then(() => mockServer.start())
      .then(reconnectsWhenServerAvailable)
    )

    it('when response timed out - throws Error and reconnects', () => {
      wsclient.wsconfig.sendTimeout = 5
      mockServer.oneTimeResponsePromise = setTimeoutPromise(20).then(() => { return { how: 'isthis' } })
      return wsclient.send({})
        .then(() => { throw new Error('expected error') })
        .catch(err => {
          wsclient.wsconfig.sendTimeout = defConfig.sendTimeout
          err.message.should.equal('response timed out')
        })
        .then(reconnectsWhenServerAvailable)
    })

    const testMessage = { hello: 1 }
    const reconnectsWhenServerAvailable = () => wsclient.send(testMessage)
      .then(response => {
        response.should.deep.equal(mockServer.nextResponse)
        mockServer.received.messages.should.deep.include(testMessage)
      })

    it('multiple clients can connect/reconnect', () => {
      const client2 = defaultClient()
      const client3 = defaultClient()
      const msg = num => { return { client: num } }
      const client1Send = () => wsclient.send(msg(1))
      const client2Send = () => client2.send(msg(2))
      const client3Send = () => client3.send(msg(3))
      return client1Send().then(client3Send)
        .then(() => wsclient.stop()).then(delay(10))
        .then(client2Send).then(client2Send).then(client1Send)
        .then(() => mockServer.received.messages
          .should.deep.equal([msg(1), msg(3), msg(2), msg(2), msg(1)]))
    })

    xit('recovers from remote socket.close', () => wsclient.stop())
    xit('recovers from remote socket.end', () => wsclient.stop())
  })
})
