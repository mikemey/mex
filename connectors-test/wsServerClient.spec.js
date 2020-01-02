const { promisify } = require('util')

const { WSServer, WSClient } = require('../connectors')
const { wsmessages: { ERROR_STATUS } } = require('../utils')

const pause = promisify(setTimeout)

describe('Real WSServer + WSClient', () => {
  const port = 12201
  const path = '/wsserverclient'

  const authTokens = ['dGhpc2lzYXRlc3RrZXkK', 'YW5vdGhlci10ZXN0aW5nLXRva2VuCg==', 'b25lLW1vcmUtdGVzdGluZy10b2tlbgo=']
  const wsserverConfig = { port, path, authTokens }
  const wsserver = new WSServer(wsserverConfig)
  const createClient = ({
    url = `ws://localhost:${port}${path}`,
    authToken = authTokens[0],
    timeout = 200,
    pingInterval = 20,
    logCategory = 'ws-server-client-test'
  } = {}) => {
    const wsclient = new WSClient({ url, timeout, authToken, pingInterval }, logCategory)
    wsclient.broadcastReceived = []
    return wsclient
  }

  let serverReceived = []
  wsserver.received = request => {
    serverReceived.push(request)
    return Promise.resolve(request)
  }

  before(() => wsserver.start())
  beforeEach(() => {
    serverReceived = []
    wsserver.received = request => {
      serverReceived.push(request)
      return Promise.resolve(request)
    }
  })
  after(() => wsserver.stop())

  describe('multiple clients', () => {
    it('send/receive messages + broadcast', () => {
      const client1 = createClient({ authToken: authTokens[0], logCategory: 'client1' })
      const client2 = createClient({ authToken: authTokens[1], logCategory: 'client2' })
      const client3 = createClient({ authToken: authTokens[2], logCategory: 'client3' })
      const client4 = createClient({ authToken: authTokens[0], logCategory: 'client4' })

      const subscribeReceived = client => (topic, message) => {
        client.broadcastReceived.push(Object.assign({ topic }, message))
      }
      wsserver.offerTopics('first', 'second', 'third')

      const send = (client, count) => client.send({ count }).then(res => res.should.deep.equal({ count }))
      const subscribe = (client, topic) => client.subscribe(topic, subscribeReceived(client)).then(res => res.status.should.equal('ok'))
      const broadcast = (topic, message) => wsserver.broadcast(topic, { message })
      const stop = client => Promise.resolve(client.stop())

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
    let wsclient
    beforeEach(() => {
      wsserver.topicSubscriptions.clear()
      wsclient = createClient()
    })
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
      received.should.deep.equal({ topic: 't2', message: testMessage })
    })

    it('mulitple subscribed/unsubscribed requests from one client', async () => {
      const topic1 = 't1'
      const topic2 = 't2'
      wsserver.offerTopics(topic1, topic2)
      const received = { topic1: { count: 0 }, topic2: { count: 0 } }
      const incrementCountOf = obj => _ => { obj.count = obj.count + 1 }
      await wsclient.subscribe(topic1, incrementCountOf(received.topic1))
      await wsclient.subscribe(topic2, incrementCountOf(received.topic2))
      await wsclient.subscribe(topic2, incrementCountOf(received.topic2))

      await wsserver.broadcast(topic1, { m: 1 })
      await wsserver.broadcast(topic2, { m: 1 })
      const unsubscribeRes = await wsclient.unsubscribe(topic1)
      unsubscribeRes.should.deep.equal([{ action: 'unsubscribe', status: 'ok' }])
      await wsclient.unsubscribe(topic1)

      await wsserver.broadcast(topic1, { m: 1 })
      await wsserver.broadcast(topic2, { m: 1 })

      await pause(15)
      received.topic1.count.should.equal(1)
      received.topic2.count.should.equal(2)
    })

    it('mulitple unsubscribes from multiple topics', async () => {
      const topic1 = 't1'
      wsserver.offerTopics(topic1)
      let counter = 0
      await wsclient.subscribe(topic1, () => counter++)
      await wsserver.broadcast(topic1, { m: 1 })

      const unsubscribeRes = await wsclient.unsubscribe('unrelated', topic1)
      unsubscribeRes.should.deep.equal([{ action: 'unsubscribe', status: 'ok' }, { action: 'unsubscribe', status: 'ok' }])
      await wsserver.broadcast(topic1, { m: 1 })

      await pause(15)
      counter.should.equal(1)
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
      .catch(err => err.message.should.equal('invalid topic [t{2]'))
    )

    xit('re-subscribes when server connection closed', async () => {
      wsserver.offerTopics('t1')
      wsserver.received = _ => { throw Error('test-error') }

      const received = {}
      const sendMessage = { any: 'thing' }
      const broadcastMessage = { test: 'message' }
      await wsclient.subscribe('t1', (topic, message) => {
        received.topic = topic
        received.message = message
      })

      const serverError = await wsclient.send(sendMessage)
      serverError.status.should.equal(ERROR_STATUS)
      wsserver.received = request => Promise.resolve(request)

      console.log('--- before resending')
      const regularResp = await wsclient.send(sendMessage)
      regularResp.should.deep.equal(sendMessage)
      console.log('--- after resending')
      await wsserver.broadcast('t1', broadcastMessage)
      await pause(4)
      console.log('--- after broadcast')
      received.should.deep.equal({ topic: 't1', message: broadcastMessage })
    })
  })
})
