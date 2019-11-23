const should = require('chai').should()
const { TestServer } = require('../testtools')

const { WSClient } = require('../security')

describe('Websocket client', () => {
  const wsclient = config => new WSClient(config)

  describe('configuration checks', () => {
    const defConfig = { url: 'ws://localhost:1234/test', authToken: '12345678901234567890' }

    const checkConfigError = (errconfig, expectedMessage) => {
      try {
        wsclient(errconfig).start()
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

  describe('connection to server', () => {
    const port = 12532
    const path = '/mockuasauth'
    const authToken = 'use-this-token-for-the-test'
    const mockServer = new TestServer(port, path)

    before(() => mockServer.start())
    after(() => mockServer.stop())

    it('uses configured authorization key', () => {
      const uas = new WSClient({ url: `ws://localhost:${port}${path}`, authToken })
      return uas.start()
        .then(() => mockServer.received.authTokens.should.include(authToken))
        .finally(() => uas.stop())
    })

    xit('when down respond with server error', () => {
      throw Error('not impl')
    })

    xit('connects when server delayed start', () => {
      throw Error('not impl')
    })

    xit('reconnects after server restart', () => {
      throw Error('not impl')
    })
  })
})
