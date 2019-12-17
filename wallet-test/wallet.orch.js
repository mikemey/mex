const WalletService = require('../wallet')
const { WSClient } = require('../connectors')
const { wsmessages: { withAction } } = require('../utils')

const { WSServerMock, TestDataSetup: { dbConfig, registeredUser } } = require('../test-tools')
const btcnodeOrch = require('./chains/btc-node.orch')

const sessionAuthToken = 'bW9jay1zZXNzaW9uLXRva2VuCg=='
const walletAuthToken = 'd2FsbGV0LXNlcnZpY2UtdG9rZW4K'
const sessionMockConfig = { path: '/wallet-sessionmock', port: 12600, authorizedTokens: [sessionAuthToken] }

const wsserverConfig = { port: 12043, path: '/wallet-test', authorizedTokens: [walletAuthToken] }
const walletServiceConfig = {
  wsserver: wsserverConfig,
  sessionService: {
    url: `ws://localhost:${sessionMockConfig.port}${sessionMockConfig.path}`,
    authToken: sessionAuthToken,
    timeout: 40
  },
  chains: {
    btcnode: btcnodeOrch.defaultBtcAdapterConfig
  },
  db: dbConfig
}

const wsClientConfig = {
  url: `ws://localhost:${wsserverConfig.port}${wsserverConfig.path}`,
  authToken: walletAuthToken,
  timeout: 500
}

const walletService = new WalletService(walletServiceConfig)
const sessionMock = new WSServerMock(sessionMockConfig, 'wallet session-mock')
const wsClient = new WSClient(wsClientConfig, 'wallet-test-client')

const startServices = async function () {
  this.timeout(60000)
  await btcnodeOrch.startNode()
  await Promise.all([sessionMock.start(), walletService.start()])
}

const stopServices = () => Promise.all([
  walletService.stop(), sessionMock.stop(), btcnodeOrch.stopNode()
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

beforeEach(() => {
  sessionMock.reset()
  sessionMock.addMockFor(verifyReq, verifyRes)
})

afterEach(() => { sessionMock.errorCheck() })

module.exports = {
  startServices, stopServices, walletService, wsClient, withJwtMessages, sessionMock, btcnodeOrch, walletServiceConfig
}
