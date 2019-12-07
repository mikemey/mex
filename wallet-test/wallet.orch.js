const WalletService = require('../wallet')
const { WSClient } = require('../connectors')
const { WSServerMock } = require('../test-tools')
const btcnode = require('./btcnode.orch')
const { wsmessages: { withAction } } = require('../utils')

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
  btcClient: btcnode.mainWalletConfig()
}

const wsClientConfig = {
  url: `ws://localhost:${walletServiceConfig.port}${walletServiceConfig.path}`,
  authToken: walletAuthToken,
  timeout: 500
}
const verifyMessages = withAction('verify')
const testJwt = '12345678909876543210'

const walletService = new WalletService(walletServiceConfig)
const sessionMock = new WSServerMock(sessionMockConfig)
sessionMock.addMockFor(verifyMessages.build({ jwt: testJwt }), verifyMessages.ok())
const wsClient = new WSClient(wsClientConfig)

const startServices = async function () {
  this.timeout(60000)
  await btcnode.start()
  await Promise.all([sessionMock.start(), walletService.start()])
}

const stopServices = () => Promise.all([
  walletService.stop(), sessionMock.stop(), btcnode.stop()
])

module.exports = { startServices, stopServices, walletService, wsClient, testJwt }
