const should = require('chai').should()
const { TestServer } = require('../testtools')

const { WSClient } = require('../security')

describe('Websocket client', () => {
  const port = 12345
  const path = 'testwsclient'
  const authToken = '12345678901234567890'
  const defConfig = { url: `ws://localhost:${port}/${path}`, authToken }
  const defaultClient = (config = defConfig) => new WSClient(config)

  describe('configuration checks', () => {
    const checkConfigError = (errconfig, expectedMessage) => {
      try {
        defaultClient(errconfig).start()
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
  })

  describe.only('connection to server', () => {
    const mockServer = new TestServer(port, path)
    const wsclient = defaultClient()
    mockServer.debug = true
    wsclient.debug = true

    before(() => mockServer.start())
    after(() => mockServer.stop())
    afterEach(() => wsclient.stop())

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

    it('uses configured authorization key', () => wsclient.start()
      .then(() => delay(10))
      .then(() => mockServer.received.authTokens.should.include(authToken))
    )

    it('when closed - throws Error', () => {
      wsclient.isReady().should.equal(false)
      return wsclient.send({})
        .then(() => { throw new Error('expected error') })
        .catch(err => { err.message.should.equal('not started') })
    })

    xit('when sending failed - throws Error', () => wsclient.start()
      .then(() => {
        wsclient.isReady().should.equal(true)
        return mockServer.stop()
      }).then(() => {
        wsclient.isReady().should.equal(false)
        return wsclient.send({})
      }).then(() => { throw new Error('expected error') })
      .catch(err => err.message.should.equal('disconnected'))
    )

    const msg1 = { msg: 1 }
    const msg2 = { msg: 2 }
    xit('reconnects after server restart', () => wsclient.start()
      .then(() => wsclient.send(msg1))
      .then(() => mockServer.stop())
      .then(() => wsclient.send({}))
      .then(() => { throw new Error('expected error') })
      .catch(err => err.message.should.equal('disconnected'))
      .then(() => mockServer.start())
      .then(() => wsclient.send(msg2))
      .then(() => mockServer.received.messages.should.deep.equal([msg1, msg2]))
    )

    xit('recovers from remote socket.close', () => wsclient.start())
    xit('recovers from remote socket.end', () => wsclient.start())
  })
})
