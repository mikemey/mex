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
  } = {}) => {
    const wsclient = new WSClient({ url, timeout, authToken })
    wsclient.broadcastReceived = []
    return wsclient
  }

  let serverReceived = []
  wsserver.received = request => {
    serverReceived.push(request)
    return Promise.resolve(request)
  }

  const pause = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))

  before(() => wsserver.start())
  beforeEach(() => { serverReceived = [] })
  after(() => wsserver.stop())

  describe('multiple clients', () => {
    it('send/receive messages + broadcast', () => {
      const client1 = createClient({ authToken: authorizedTokens[0] })
      const client2 = createClient({ authToken: authorizedTokens[1] })
      const client3 = createClient({ authToken: authorizedTokens[2] })
      const client4 = createClient({ authToken: authorizedTokens[0] })

      const subscribeReceived = client => (topic, message) => {
        client.broadcastReceived.push(Object.assign({ topic }, message))
      }
      wsserver.offerTopics('first', 'second', 'third')

      const send = (client, count) => client.send({ count }).then(res => res.should.deep.equal({ count }))
      const subscribe = (client, topic) => client.subscribe(topic, subscribeReceived(client)).then(res => res.status.should.equal('ok'))
      const broadcast = (topic, message) => wsserver.broadcast(topic, { message })
      const stop = client => client.stop()

      return Promise
        .all([send(client1, 100), send(client2, 10), send(client3, 1)])
        .then(() => Promise.all([
          send(client1, 200).then(() => send(client1, 300)).then(() => stop(client1)).then(() => send(client1, 100)),
          stop(client2).then(() => send(client2, 10)).then(() => stop(client2)).then(() => send(client2, 20)).then(() => send(client2, 30)),
          subscribe(client3, 'first').then(() => send(client3, 3)).then(() => send(client3, 2)).then(() => send(client3, 1)),
          subscribe(client4, 'first').then(() => subscribe(client4, 'second')).then(() => broadcast('first', 3))
            .then(() => broadcast('second', 7)).then(() => broadcast('third', 1)).then(() => broadcast('first', 5)) // .then(() => pause(10))
        ]))
        .then(() => {
          const actualSum = serverReceived
            .map(req => req.count)
            .reduce((a, b) => a + b, 0)
          actualSum.should.equal(777)

          client1.broadcastReceived.should.deep.equal([])
          client2.broadcastReceived.should.deep.equal([])
          client3.broadcastReceived.should.deep.equal([{ topic: 'first', message: 3 }, { topic: 'first', message: 5 }])
          client4.broadcastReceived.should.deep.equal([
            { topic: 'first', message: 3 }, { topic: 'second', message: 7 }, { topic: 'first', message: 5 }
          ])
        }).finally(() => Promise.all([stop(client1), stop(client2), stop(client3), stop(client4)]))
    })
  })

  describe('topic subscriptions', () => {
    const wsclient = createClient()
    beforeEach(() => { wsserver.topics = {} })
    afterEach(() => {
      serverReceived.should.deep.equal([])
      return wsclient.stop()
    })

    it('accepts subscriptions, sends broadcast', async () => {
      wsserver.offerTopics('t1', 't2')
      const received = {}
      const testMessage = { hello: 'world' }
      const subscribeRes = await wsclient.subscribe('t2', (topic, message) => {
        received.topic = topic
        received.message = message
      })
      subscribeRes.should.deep.equal({ action: 'subscribe', status: 'ok' })

      await wsserver.broadcast('t2', testMessage)
      await pause(10)
      received.topic.should.equal('t2')
      received.message.should.deep.equal(testMessage)
    })

    it('reject invalid subscriptions', async () => {
      wsserver.offerTopics('t1')
      const subscribeRes = await wsclient.subscribe('xx', (topic, message) => { })
      subscribeRes.should.deep.equal({ action: 'subscribe', status: 'nok' })
    })

    it('error when broadcasting invalid topic', () => {
      wsserver.offerTopics('t3')
      return wsserver.broadcast('t1', {})
        .then(() => { throw new Error('expected invalid topic error') })
        .catch(err => err.message.should.equal('invalid topic [t1]'))
    })

    it('error when offerTopics topic name contains curly braces', () =>
      (() => wsserver.offerTopics('t{2')).should.throw(Error, 'invalid topic name [t{2]')
    )

    it('error when broadcast topic name contains curly braces', () => wsserver.broadcast('t{2', {})
      .then(() => { throw new Error('expected invalid topic error') })
      .catch(err => err.message.should.equal('invalid topic name [t{2]'))
    )
  })
})
