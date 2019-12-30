const { SocketServer, SocketClient } = require('../connectors')

const { promisify } = require('util')

// const pause = promisify(setTimeout)

describe('Real SocketServer + SocketClient', () => {
  const address = 'ipc:///tmp/socketservertest'
  const authorizedTokens = ['dGhpc2lzYXRlc3RrZXkK', 'YW5vdGhlci10ZXN0aW5nLXRva2VuCg==', 'b25lLW1vcmUtdGVzdGluZy10b2tlbgo=']

  const serverConfig = { address, authorizedTokens }
  const sockServer = new SocketServer(serverConfig)
  const createClient = ({ authToken = authorizedTokens[0], name }) => {
    const client = SocketClient({ address, authToken, timeout: 300 }, name)
    client.broadcastReceived = []
    return client
  }

  let serverReceived = []
  sockServer.received = request => {
    serverReceived.push(request)
    return Promise.resolve(request)
  }

  before(() => sockServer.start())
  beforeEach(() => { serverReceived = [] })
  after(() => sockServer.stop())

  describe('multiple clients', () => {
    it('send/receive messages + broadcast', () => {
      const client1 = createClient({ authToken: authorizedTokens[0], name: 'c1' })
      const client2 = createClient({ authToken: authorizedTokens[1], name: 'c2' })
      const client3 = createClient({ authToken: authorizedTokens[2], name: 'c3' })
      const client4 = createClient({ authToken: authorizedTokens[0], name: 'c4' })

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
    let sockClient
    beforeEach(() => {
      // sockServer.topicSubscriptions.clear()
      sockClient = createClient({ authToken: authorizedTokens[0], name: 'topic-client' })
    })
    afterEach(() => {
      serverReceived.should.deep.equal([])
      return sockClient.stop()
    })

    it.only('accepts subscriptions, sends broadcast', async () => {
      sockServer.offerTopics('t1', 't2')
      const received = {}
      const testMessage = { hello: 'world' }
      const subscribeRes = await sockClient.subscribe('t2', (topic, message) => {
        received.topic = topic
        received.message = message
      })
      subscribeRes.should.deep.equal({ action: 'subscribe', status: 'ok' })

      await sockServer.broadcast('t2', testMessage)
      // await pause(10)
      received.topic.should.equal('t2')
      received.message.should.deep.equal(testMessage)
    })

    it('mulitple subscribed/unsubscribed clients', async () => {
      const topic1 = 't1'
      const topic2 = 't2'
      wsserver.offerTopics(topic1, topic2)
      const received = { topic1: { count: 0 }, topic2: { count: 0 } }
      const incrementCountOf = obj => _ => { obj.count = obj.count + 1 }
      await wsclient.subscribe(topic1, incrementCountOf(received.topic1))
      await wsclient.subscribe(topic2, incrementCountOf(received.topic2))
      await wsclient.subscribe(topic2, incrementCountOf(received.topic2))
      await wsclient.subscribe(topic2, incrementCountOf(received.topic2))

      await wsserver.broadcast(topic1, { m: 1 })
      await wsserver.broadcast(topic2, { m: 1 })
      await wsclient.unsubscribe(topic1)

      await wsserver.broadcast(topic1, { m: 1 })
      await wsserver.broadcast(topic2, { m: 1 })

      await pause(15)
      received.topic1.count.should.equal(1)
      received.topic2.count.should.equal(2)
    })

    it('ignores closed clients', async () => {
      const topic1 = 't1'
      const received = { client1: { count: 0 }, client2: { count: 0 } }

      wsserver.offerTopics(topic1)
      await wsclient.subscribe(topic1, _ => {
        received.client1.count = received.client1.count + 1
        return wsclient.stop()
      })
      await wsserver.broadcast(topic1, { m: 1 })
      await wsserver.broadcast(topic1, { m: 1 })
      await pause(15)

      received.client1.count.should.equal(1)
    })

    it('allows broadcast without subscriptions', async () => {
      wsserver.offerTopics('t1')
      await wsserver.broadcast('t1', { what: 'ever' })
    })

    it('reject invalid subscriptions', async () => {
      wsserver.offerTopics('t1')
      const subscribeRes = await wsclient.subscribe('xx', _ => { })
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
