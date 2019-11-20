const chai = require('chai')
const should = chai.should()
chai.use(require('chai-http'))

const { HTTPAuth } = require('../security')

describe('HTTP authorization', () => {
  process.env.TESTING = true

  const config = {
    port: 12012,
    path: '/test',
    version: 'test-ver-45254',
    interface: '0.0.0.0',
    suppressRequestLog: []
  }

  describe('config checks', () => {
    const checkConfigError = (errconfig, expectedMessage) => {
      try {
        new HTTPAuth(errconfig).start()
        should.fail('expected error')
      } catch (err) {
        err.message.should.equal(expectedMessage)
      }
    }

    it('version required', () => checkConfigError(
      { interface: '0.0.0.0', port: 1, path: '/path', suppressRequestLog: [] },
      '"version" is required')
    )
    it('interface required', () => checkConfigError(
      { version: '1', port: 1, path: '/path', suppressRequestLog: [] },
      '"interface" is required')
    )
    it('interface not an ip', () => checkConfigError(
      { version: '1', interface: '127.a.0.1', port: 1, path: '/path', suppressRequestLog: [] },
      '"interface" not valid')
    )
    it('port required', () => checkConfigError(
      { version: '1', interface: '127.0.0.1', path: '/path', suppressRequestLog: [] },
      '"port" is required')
    )
    it('port too large', () => checkConfigError(
      { version: '1', interface: '127.0.0.1', port: 65536, path: '/path', suppressRequestLog: [] },
      '"port" must be a valid port')
    )
    it('path required', () => checkConfigError(
      { version: '1', interface: '127.0.0.1', port: 1, suppressRequestLog: [] },
      '"path" is required')
    )
    it('path without leading slash', () => checkConfigError(
      { version: '1', interface: '127.0.0.1', port: 1, path: 'path', suppressRequestLog: [] },
      '"path" not valid')
    )
    it('suppressRequestLog required', () => checkConfigError(
      { version: '1', interface: '127.0.0.1', port: 1, path: '/path' },
      '"suppressRequestLog" is required')
    )
    it('suppressRequestLog not an array', () => checkConfigError(
      { version: '1', interface: '127.0.0.1', port: 1, path: '/path', suppressRequestLog: 'lala' },
      '"suppressRequestLog" must be an array')
    )
  })

  describe('default responses', () => {
    it('serves version', () => {
      const httpauth = new HTTPAuth(config)
      return httpauth.start()
        .then(() => chai.request
          .agent(`http://localhost:${config.port}${config.path}`)
          .get('/version'))
        .then(res => {
          res.text.should.startWith(config.version)
        })
        .finally(() => httpauth.stop())
    })
  })

  // xdescribe('service implementation error', () => {
  // const testClient = new TestClient()
  // class FailingService extends WSAuth {
  //   constructor () {
  //     super(testClient.wssconfig)
  //   }

  //   received (_) {
  //     return Promise.reject(Error('test-error'))
  //   }
  // }

  // const failService = new FailingService()
  // before(() => failService.start())
  // after(() => failService.stop())
  // beforeEach(() => testClient.connect())
  // afterEach(() => testClient.close())

  // it('processing failure should result in error response', () => {
  //   const request = { action: 'test' }
  //   return testClient.send(request)
  //     .then(result => {
  //       result.status.should.equal('error')
  //       result.message.should.deep.equal(request)
  //     })
  // })
  // })
})
