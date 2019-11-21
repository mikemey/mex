const cookie = require('cookie')
const express = require('express')
const chai = require('chai')
const should = chai.should()
chai.use(require('chai-http'))

const { HTTPAuth } = require('../security')

describe('HTTP authorization', () => {
  process.env.TESTING = true

  const config = {
    port: 12012,
    path: '/testhttpauth',
    version: 'test-ver-45254',
    interface: '0.0.0.0',
    suppressRequestLog: []
  }

  class HTTPAuthImpl extends HTTPAuth {
    constructor () {
      super(config)
      this.testResponse = 'hey you'
      this.testEndpoint = '/theend'
      this.testFailEndpoint = '/fail'
    }

    getRouter () {
      const router = express.Router()
      router.get(this.testEndpoint, (_, res) => res.send(this.testResponse))
      router.post(this.testEndpoint, (_, res) => res.send(this.testResponse))
      router.get(this.testFailEndpoint, (_, res) => {
        const err = new Error('test error')
        delete err.stack
        throw err
      })
      return router
    }
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
    it('port not valid', () => checkConfigError(
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
    const SESSION_COOKIE_NAME = 'x-session'
    const serverPath = `http://localhost:${config.port}${config.path}`
    const httpauth = new HTTPAuthImpl(config)
    const agent = chai.request.agent(serverPath)

    before(() => httpauth.start())
    after(() => httpauth.stop())

    it('serves version', () => agent.get('/version')
      .then(res => {
        res.should.have.status(200)
        res.text.should.startWith(config.version)
      })
    )

    it('serves implemented route', () => agent.get(httpauth.testEndpoint)
      .then(res => res.text.should.equal(httpauth.testResponse))
    )

    it('serves 404 when invalid route', () => agent.get(httpauth.testEndpoint + 'x')
      .then(res => res.should.have.status(404))
    )

    it('serves 500 when server error', () => agent.get(httpauth.testFailEndpoint)
      .then(res => {
        res.should.have.status(500)
        return agent.get(httpauth.testEndpoint)
      }).then(res => res.should.have.status(200))
    )

    it('response has session', () => chai.request(serverPath).get(httpauth.testEndpoint)
      .then(res => {
        const session = res.header['set-cookie']
          .map(header => cookie.parse(header))
          .find(cookie => cookie[SESSION_COOKIE_NAME])
        should.exist(session, 'session cookie')
      })
    )

    it('valid session pass through', () => agent.get(httpauth.testEndpoint)
      .then(res => {
        res.should.have.status(200)
        return agent.post(httpauth.testEndpoint)
      }).then(res => {
        res.should.have.status(200)
        res.text.should.equal(httpauth.testResponse)
      })
    )

    it('error response when post without csrf', () => chai.request(serverPath)
      .post(httpauth.testEndpoint)
      .then(res => { res.should.have.status(403) })
    )
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
