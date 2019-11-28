const should = require('chai').should()
const _ = require('underscore')

const { WSServer } = require('../security')

class SessionMock extends WSServer {
  constructor (config) {
    super(config)
    this.reset()
  }

  reset () {
    this.receivedRequests = []
    this.mockResponses = []
    this.error = false
  }

  errorCheck () {
    if (this.error) { should.fail(this.error) }
  }

  addMockFor (expectedRequest, mockResponse) {
    if (expectedRequest.constructor === Object && mockResponse.constructor === Object) {
      this.mockResponses.push({ req: expectedRequest, res: mockResponse })
    } else {
      throw new Error('mock request/response expected to be objects')
    }
  }

  assertReceived (...requests) {
    this.receivedRequests.should.deep.equal([...requests])
  }

  received (request) {
    this.receivedRequests.push(request)
    const mock = this.mockResponses.find(m => _.isEqual(m.req, request))
    if (mock) {
      return Promise.resolve(mock.res)
    }
    this.error = 'SessionMock: unexpected request: ' + JSON.stringify(request) +
      '\nMocks available:\n' + JSON.stringify(this.mockResponses)
    return Promise.resolve({})
  }
}

module.exports = SessionMock
