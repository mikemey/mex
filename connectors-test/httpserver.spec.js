const cookie = require('cookie')
const chai = require('chai')
const should = chai.should()
chai.use(require('chai-http'))
chai.use(require('chai-string'))

const { HttpServer } = require('../connectors')

describe('HTTP Server', () => {
  const config = {
    secret: '12345678901234567890',
    port: 12012,
    path: '/testhttpserver',
    version: 'test-123',
    interface: '0.0.0.0',
    suppressRequestLog: []
  }

  class HttpServerImpl extends HttpServer {
    constructor () {
      super(config)
      this.testResponse = 'hey you'
      this.testEndpoint = '/theend'
      this.testFailEndpoint = '/fail'
    }

    addRoutes (router) {
      router.get(this.testEndpoint, (_, res) => res.send(this.testResponse))
      router.post(this.testEndpoint, (_, res) => res.send(this.testResponse))
      router.get(this.testFailEndpoint, (_, res) => {
        const err = new Error('test error')
        delete err.stack
        throw err
      })
    }
  }

  describe('default responses', () => {
    const SESSION_COOKIE_NAME = 'x-session'
    const serverPath = `http://localhost:${config.port}${config.path}`
    const httpserver = new HttpServerImpl(config)
    const agent = chai.request.agent(serverPath)

    before(() => httpserver.start())
    after(() => httpserver.stop())

    it('serves version', () => agent.get('/version')
      .then(res => {
        res.should.have.status(200)
        res.text.should.startWith(config.version)
      })
    )

    it('serves implemented route', () => agent.get(httpserver.testEndpoint)
      .then(res => res.text.should.equal(httpserver.testResponse))
    )

    it('serves 404 when invalid route', () => agent.get(httpserver.testEndpoint + 'x')
      .then(res => res.should.have.status(404))
    )

    it('serves 500 when server error', () => agent.get(httpserver.testFailEndpoint)
      .then(res => {
        res.should.have.status(500)
        return agent.get(httpserver.testEndpoint)
      }).then(res => res.should.have.status(200))
    )

    it('response has session', () => chai.request(serverPath).get(httpserver.testEndpoint)
      .then(res => {
        const session = res.header['set-cookie']
          .map(header => cookie.parse(header))
          .find(cookie => cookie[SESSION_COOKIE_NAME])
        should.exist(session, 'session cookie')
      })
    )

    it('valid session pass through', () => agent.get(httpserver.testEndpoint)
      .then(res => {
        res.should.have.status(200)
        return agent.post(httpserver.testEndpoint)
      }).then(res => {
        res.should.have.status(200)
        res.text.should.equal(httpserver.testResponse)
      })
    )

    it('error response when post without csrf', () => chai.request(serverPath)
      .post(httpserver.testEndpoint)
      .then(res => { res.should.have.status(403) })
    )
  })
})
