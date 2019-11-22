const chai = require('chai')
const should = chai.should()
chai.use(require('chai-string'))
// const uws = require('uWebSockets.js')

const orchestrator = require('./orchestrator')
const UserAccountService = require('../useraccount')
const { httpauth } = require('../useraccount/defaults.json')

describe('UserAccountService', () => {
  describe('common', () => {
    const agent = orchestrator.agent()
    before(() => orchestrator.start())
    after(() => orchestrator.stop())

    it('responds with configured version', () => agent.get('/version')
      .then(res => res.text.should.startWith(httpauth.version))
    )
  })

  describe('configuration checks', () => {
    const defConfig = {
      httpauth: { port: 2000 },
      sessionService: { url: 'ws://localhost:1234/test', authToken: '12345678901234567890' }
    }

    const checkConfigError = (errconfig, expectedMessage) => {
      try {
        new UserAccountService(errconfig).start()
        should.fail('expected error')
      } catch (err) {
        err.message.should.equal(expectedMessage)
      }
    }
    const deleteKey = (deleteField, expectedMessage) => {
      const errconfig = Object.assign({}, defConfig)
      errconfig.sessionService = Object.assign({}, defConfig.sessionService)
      delete errconfig.sessionService[deleteField]
      return checkConfigError(errconfig, expectedMessage)
    }
    const withKey = (overwrite, expectedMessage) => {
      const errconfig = Object.assign({}, defConfig)
      errconfig.sessionService = Object.assign({}, defConfig.sessionService, overwrite)
      return checkConfigError(errconfig, expectedMessage)
    }

    it('sessionService.url required', () => deleteKey('url', '"sessionService.url" is not allowed to be empty'))
    it('sessionService.url invalid', () => withKey({ url: 'something-else' }, '"sessionService.url" must be a valid uri'))
    it('sessionService.authToken required', () =>
      deleteKey('authToken', '"sessionService.authToken" is not allowed to be empty'))
    it('sessionService.authToken too short', () =>
      withKey({ authToken: '1234567890123456789' }, '"sessionService.authToken" too short'))
  })

  // describe('connect to SessionService', () => {
  //   xit('uses configured authorization key', () => {
  //     const mockPort = 12532
  //     const mockPath = '/mockuasauth'
  //     const authToken = 'use-this-token'
  //     const config = {
  //       httpauth: { path: '/uasauth', port: 12014 },
  //       sessionService: { url: `ws://localhost:${mockPort}${mockPath}`, authToken }
  //     }
  //     const uas = new UserAccountService(config)
  //     return uas.start()
  //     // return new Promise((resolve, reject) => {
  //     //   uws.App({}).ws(mockPort, {
  //     //     open: (ws, req) => {
  //     //       const receivedToken = req.getHeader('x-auth-token')
  //     //       receivedToken.should.equal(authToken)
  //     //     }
  //     //   }).listen(mockPath, socket => {
  //     //     if (socket) {
  //     //       resolve(socket)
  //     //     } else {
  //     //       const msg = `failed to listen on port ${this.port}`
  //     //       reject(Error(msg))
  //     //     }
  //     //   })
  //     // })
  //   })
  // })
})
