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
    this.counter = 0
  }

  errorCheck () {
    if (this.error) { should.fail(this.error) }
  }

  addMockFor (expectedRequest, mockResponse) {
    if (expectedRequest.constructor !== Object ||
      (mockResponse.constructor !== Promise && mockResponse.constructor !== Object)
    ) { throw new Error('mock request not an object') }

    const responsePromise = mockResponse.constructor === Object ? Promise.resolve(mockResponse) : mockResponse
    this.mockResponses.push({ req: expectedRequest, res: responsePromise })
  }

  assertReceived (...requests) {
    this.receivedRequests.should.deep.equal([...requests])
  }

  received (request) {
    this.counter += 1
    this.receivedRequests.push(request)
    const mock = this.mockResponses.find(m => _.isEqual(m.req, request))
    if (mock) { return mock.res }

    this.error = 'WSServerMock: unexpected request: ' + JSON.stringify(request) +
      '\nMocks available:\n' + JSON.stringify(this.mockResponses)
    return Promise.resolve({})
  }
}

module.exports = SessionMock
