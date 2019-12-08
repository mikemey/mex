const WalletService = require('../wallet')
const { WSClient } = require('../connectors')
const { wsmessages: { withAction } } = require('../utils')

const { WSServerMock, TestDataSetup: { dbConfig } } = require('../test-tools')
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
  btcClient: btcnode.walletConfig(),
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
beforeEach(async () => {
  sessionMock.reset()
  sessionMock.addMockFor(verifyMessages.build({ jwt: testJwt }), verifyMessages.ok())
})
afterEach(() => sessionMock.errorCheck())

const withJwt = obj => Object.assign(obj, { jwt: testJwt })

module.exports = { startServices, stopServices, walletService, wsClient, withJwt, sessionMock }
