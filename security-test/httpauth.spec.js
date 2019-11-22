const cookie = require('cookie')
const chai = require('chai')
const should = chai.should()
chai.use(require('chai-http'))

const { HTTPAuth } = require('../security')

describe('HTTP authorization', () => {
  const config = {
    secret: '123456789012',
    port: 12012,
    path: '/testhttpauth',
    version: 'test-123',
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
})
