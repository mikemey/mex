const { Dealer } = require('zeromq')

const { SocketServer, SocketClient } = require('../connectors')
const { randomString, errors, wsmessages } = require('../utils')

describe('Socket Server', () => {
  const defServerData = { expected: {}, resolve: true, response: {}, err: null }
  let currentServerData = defServerData
  const resetServerData = () => { currentServerData = Object.assign({}, defServerData) }

  class ExampleSocketServer extends SocketServer {
    received (req) {
      try {
        req.should.deep.equal(currentServerData.expected)
        return currentServerData.resolve
          ? Promise.resolve(currentServerData.response)
          : Promise.reject(currentServerData.response)
      } catch (err) {
        currentServerData.err = err
        throw err
      }
    }
  }

  const address = 'ipc:///tmp/socketservertest'
  const testToken = 'dGhpc2lzYXRlc3RrZXkK'

  const authorizedTokens = [testToken, 'YW5vdGhlci10ZXN0aW5nLXRva2VuCg==', 'b25lLW1vcmUtdGVzdGluZy10b2tlbgo=']
  const serverConfig = { address, authorizedTokens }
  const sockServer = new ExampleSocketServer(serverConfig)
  const clientMock = SocketClient({ address, authToken: testToken, timeout: 500 }, 'mock-client')

  beforeEach(resetServerData)
  afterEach(() => {
    if (currentServerData.err) {
      throw currentServerData.err
    }
  })

  describe('connection handling', () => {
    before(() => sockServer.start())
    after(() => sockServer.stop())
    afterEach(() => serverContinuesOperation().then(clientMock.stop))

    const serverContinuesOperation = () => {
      resetServerData()
      currentServerData.expected = { continue: true }
      currentServerData.response = { yes: 'ican' }
      return clientMock.send(currentServerData.expected)
        .then(res => res.should.deep.equal(currentServerData.response))
    }

    it('allows correct auth token', () => {
      currentServerData.expected = { continue: true }
      currentServerData.response = { yes: 'ican' }
      return clientMock.send(currentServerData.expected)
        .then(res => res.should.deep.equal(currentServerData.response))
    })

    const waitForAuthenticationFailure = (done, { user = 'user', token = testToken }) => {
      const client = new Dealer()
      client.events.on('handshake:error:auth', ({ error }) => {
        error.message.should.equal('Authentication failure')
        client.close()
        done()
      })
      client.plainUsername = user
      client.plainPassword = token
      client.connect(address)
    }

    it('when invalid user name', done => waitForAuthenticationFailure(done, { user: 'invalid' }))
    it('when invalid auth token', done => waitForAuthenticationFailure(done, { token: 'blabla' }))

    it('when payload too large', () => clientMock
      .send({ action: randomString(4 * 1024) })
      .then(() => { throw new Error('expected disconnected error') })
      .catch(err => err.message.should.equal('disconnected'))
    )

    const expectErrorResponse = ({ id, customResponse = null, ErrorClass = errors.ClientError }) => {
      const request = { implerror: id }
      currentServerData.resolve = false
      currentServerData.expected = request
      currentServerData.response = new ErrorClass(`wss impl error test ${id}`, customResponse)
      return clientMock
        .send(currentServerData.expected)
        .then(result => result.should.deep.equal(customResponse || wsmessages.error(request)))
    }

    it('implementation throws ClientError', () => expectErrorResponse({ id: 1 }))

    it('implementation throws ClientError with specific response', () => expectErrorResponse(
      { id: 2, customResponse: { clienterror: 'custom response 1' } }
    ))

    it('implementation throws generic error', () => expectErrorResponse({ id: 3, ErrorClass: Error }))
  })

  describe('server configuration/usage error', () => {
    it('when already running', () => sockServer.start()
      .then(() => sockServer.start())
      .then(() => { throw new Error('expected start error') })
      .catch(err => err.message.should.equal('server already started'))
      .finally(() => sockServer.stop())
    )

    const allowedConfig = { address, authorizedTokens: ['a-token'] }
    const configWith = (overwrite, expectedMessage) => {
      const errconfig = Object.assign({}, allowedConfig, overwrite)
      checkConfigError(errconfig, expectedMessage)
    }

    const configWithout = (deleteField, expectedMessage) => {
      const errconfig = Object.assign({}, allowedConfig)
      delete errconfig[deleteField]
      checkConfigError(errconfig, expectedMessage)
    }

    const checkConfigError = (errconfig, expectedMessage) =>
      (() => new SocketServer(errconfig)).should.throw(Error, expectedMessage)

    it('address required', () => configWithout('address', '"address" is required'))
    it('authorizedTokens required', () => configWithout('authorizedTokens', '"authorizedTokens" is required'))
    it('authorizedTokens not an array', () => configWith({ authorizedTokens: 'lala' }, '"authorizedTokens" must be an array'))
    it('authorizedTokens contains non-string', () =>
      configWith({ authorizedTokens: ['abcdefghijklmnopqrst', 3] }, '"authorizedTokens[1]" must be a string'))
  })
})
