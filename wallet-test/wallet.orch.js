const BitcoinClient = require('bitcoin-core')

const WalletService = require('../wallet')
const { WSClient } = require('../connectors')
const { wsmessages: { withAction }, dbconnection } = require('../utils')

const { WSServerMock, TestDataSetup: { dbConfig, registeredUser } } = require('../test-tools')
const btcnode = require('./btcnode.orch')

const sessionAuthToken = 'bW9jay1zZXNzaW9uLXRva2VuCg=='
const walletAuthToken = 'd2FsbGV0LXNlcnZpY2UtdG9rZW4K'
const sessionMockConfig = { path: '/wallet-sessionmock', port: 12600, authorizedTokens: [sessionAuthToken] }

const walletServiceConfig = {
  port: 12043,
  path: '/wallet-test',
  authorizedTokens: [walletAuthToken],
  sessionService: {
    url: `ws://localhost:${sessionMockConfig.port}${sessionMockConfig.path}`,
    authToken: sessionAuthToken,
    timeout: 40
  },
  btcnode: {
    client: btcnode.walletConfig(),
    zmq: btcnode.zmqConfig
  },
  db: dbConfig
}

const wsClientConfig = {
  url: `ws://localhost:${walletServiceConfig.port}${walletServiceConfig.path}`,
  authToken: walletAuthToken,
  timeout: 500
}

const walletService = new WalletService(walletServiceConfig)
const sessionMock = new WSServerMock(sessionMockConfig)
const wsClient = new WSClient(wsClientConfig)

const startServices = async function () {
  this.timeout(60000)
  await btcnode.start()
  await Promise.all([sessionMock.start(), walletService.start()])
}

const stopServices = () => Promise.all([
  walletService.stop(), sessionMock.stop(), btcnode.stop()
])

const verifyMessages = withAction('verify')
const testJwt = '12345678909876543210'
const verifyReq = verifyMessages.build({ jwt: testJwt })
const verifyRes = verifyMessages.ok({ user: { id: registeredUser.id, email: registeredUser.email } })

const withJwtMessages = (action, jwt = testJwt) => {
  const baseAction = withAction(action)
  const build = obj => baseAction.build(Object.assign({ jwt }, obj))
  return { build }
}

const createDepositAddress = async (id = registeredUser.id) => {
  const mainWallet = new BitcoinClient(btcnode.walletConfig())
  const address = await mainWallet.getNewAddress()
  await dbconnection.collection('addresses').insertOne(
    { _id: dbconnection.ObjectId(id), reserved: [{ symbol: 'btc', address }] }
  )
}

beforeEach(() => {
  sessionMock.reset()
  sessionMock.addMockFor(verifyReq, verifyRes)
})

afterEach(() => { sessionMock.errorCheck() })

module.exports = {
  startServices, stopServices, walletService, wsClient, withJwtMessages, sessionMock, createDepositAddress
}
