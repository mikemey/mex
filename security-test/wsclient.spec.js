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

  xdescribe('connection to server', () => {
    const port = 12532
    const path = '/mockuasauth'
    const authToken = 'use-this-token-for-the-test'
    const mockServer = new TestServer(port, path)

    // before(() => mockServer.start())
    // after(() => mockServer.stop())

    it('uses configured authorization key', () => {
      const config = { url: `ws://localhost:${port}${path}`, authToken }

      const uas = new WSClient(config)
      uas.debug = true
      const wssmock = mockServer(port, path)
      return wssmock.start()
        .then(() => uas.start())
        .then(() => wssmock.received.authTokens.should.include(authToken))
        .finally(() => {
          console.log('------ CALLING STOP ON UserAccountService')
          uas.stop()
        })
        .finally(() => {
          console.log('------ CALLING STOP ON mockServer')
          wssmock.stop()
        })
    })

    it('when down respond with server error', () => {
      throw Error('not impl')
    })

    it('connects when server delayed start', () => {
      throw Error('not impl')
    })

    it('reconnects after server restart', () => {
      throw Error('not impl')
    })
  })
})
