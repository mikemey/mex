const chai = require('chai')
const should = chai.should()
chai.use(require('chai-http'))

const { HTTPAuth } = require('../security')

describe('HTTP authorization configuration', () => {
  const config = {
    secret: '123456789012',
    port: 12013,
    path: '/Test-http-auth0',
    version: 'test-Ver-45254',
    interface: '127.0.0.1',
    suppressRequestLog: []
  }

  describe('config checks', () => {
    const configWith = (overwrite, expectedMessage) => {
      const errconfig = Object.assign({}, config, overwrite)
      return checkConfigError(errconfig, expectedMessage)
    }

    const configWithout = (deleteField, expectedMessage) => {
      const errconfig = Object.assign({}, config)
      delete errconfig[deleteField]
      return checkConfigError(errconfig, expectedMessage)
    }

    const checkConfigError = (errconfig, expectedMessage) => {
      try {
        new HTTPAuth(errconfig).start()
        should.fail('expected error')
      } catch (err) {
        err.message.should.equal(expectedMessage)
      }
    }

    it('secret required', () => configWithout('secret', '"secret" is required'))
    it('secret too short', () => configWith({ secret: '12345678901' }, '"secret" too short'))
    it('version required', () => configWithout('version', '"version" is required'))
    it('interface required', () => configWithout('interface', '"interface" is required'))
    it('interface not an ip', () => configWith({ interface: '127.a.0.1' }, '"interface" not valid'))
    it('port required', () => configWithout('port', '"port" is required'))
    it('port not valid', () => configWith({ port: 65536 }, '"port" must be a valid port'))
    it('path required', () => configWithout('path', '"path" is required'))
    it('path without leading slash', () => configWith({ path: 'path' }, '"path" not valid'))
    it('path without leading slash', () => configWith({ path: '/p' }, '"path" not valid'))
    it('suppressRequestLog required', () => configWithout('suppressRequestLog', '"suppressRequestLog" is required'))
    it('suppressRequestLog not an array', () => configWith({ suppressRequestLog: 'lala' }, '"suppressRequestLog" must be an array'))
  })

  describe('service implementation error', () => {
    class NoRouteService extends HTTPAuth {
      constructor () {
        super(config)
      }
    }

    it('when getRouter implementation missing', () => {
      let serviceFailed = true
      return new NoRouteService().start()
        .then(() => { serviceFailed = false })
        .catch(err => err.message.should.equal('missing getRouter() implementation'))
        .finally(() => serviceFailed.should.equal(true, 'expected error'))
    })
  })
})
