const { WSServer, WSClient } = require('../connectors')

describe('Real WSServer + WSClient', () => {
  const port = 12201
  const path = '/wsserverclient'

  const authorizedTokens = ['dGhpc2lzYXRlc3RrZXkK', 'YW5vdGhlci10ZXN0aW5nLXRva2VuCg==', 'b25lLW1vcmUtdGVzdGluZy10b2tlbgo=']
  const wsserverConfig = { port, path, authorizedTokens }
  const wsserver = new WSServer(wsserverConfig)
  const createClient = ({
    url = `ws://localhost:${port}${path}`,
    timeout = 200,
    authToken = authorizedTokens[0]
  } = {}) => new WSClient({ url, timeout, authToken })

  let serverReceived = []
  wsserver.received = request => {
    serverReceived.push(request)
    return Promise.resolve(request)
  }

  before(() => {
    serverReceived = []
    return wsserver.start()
  })
  after(() => wsserver.stop())

  it('multiple clients can send/receive', () => {
    const client1 = createClient({ authToken: authorizedTokens[0] })
    const client2 = createClient({ authToken: authorizedTokens[1] })
    const client3 = createClient({ authToken: authorizedTokens[2] })

    const send = (client, count) => client.send({ count }).then(result => result.should.deep.equal({ count }))
    const stop = client => client.stop()
    return Promise
      .all([send(client1, 100), send(client2, 10), send(client3, 1)])
      .then(() => Promise.all([
        send(client1, 200).then(() => send(client1, 300)).then(() => stop(client1)).then(() => send(client1, 100)),
        stop(client2).then(() => send(client2, 10)).then(() => stop(client2)).then(() => send(client2, 20)).then(() => send(client2, 30)),
        send(client3, 3).then(() => send(client3, 2)).then(() => send(client3, 1))
      ]))
      .then(() => {
        const actualSum = serverReceived
          .map(req => req.count)
          .reduce((a, b) => a + b, 0)
        actualSum.should.equal(777)
      }).finally(() => Promise.all([stop(client1), stop(client2), stop(client3)]))
  })
})
