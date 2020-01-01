const WalletService = require('../wallet')
const { WSClient } = require('../connectors')
const { wsmessages: { withAction } } = require('../utils')

const { WSServerMock, TestDataSetup: { dbConfig, registeredUser } } = require('../test-tools')
const chainsOrch = require('./chains.orch')

const sessionAuthToken = 'bW9jay1zZXNzaW9uLXRva2VuCg=='
const walletAuthToken = 'd2FsbGV0LXNlcnZpY2UtdG9rZW4K'
const sessionMockConfig = { path: '/wallet-sessionmock', port: 12600, authTokens: [sessionAuthToken] }

const wsserverConfig = { port: 12043, path: '/wallet-test', authTokens: [walletAuthToken] }
const walletServiceConfig = {
  wsserver: wsserverConfig,
  sessionService: {
    url: `ws://localhost:${sessionMockConfig.port}${sessionMockConfig.path}`,
    authToken: sessionAuthToken,
    timeout: 40,
    pingInterval: 10000
  },
  chains: {
    btcnode: chainsOrch.getChainOrch('btc').defaultBtcAdapterConfig
  },
  db: dbConfig
}

const wsClientConfig = {
  url: `ws://localhost:${wsserverConfig.port}${wsserverConfig.path}`,
  authToken: walletAuthToken,
  timeout: 500,
  pingInterval: 10000
}

const walletService = new WalletService(walletServiceConfig)
const sessionMock = new WSServerMock(sessionMockConfig, 'wallet session-mock')
const wsClient = new WSClient(wsClientConfig, 'wallet-test-client')

const startServices = async function () {
  this.timeout(60000)
  await chainsOrch.startNodes()
  await Promise.all([sessionMock.start(), walletService.start()])
}

const stopServices = () => Promise.all([
  walletService.stop(), sessionMock.stop(), chainsOrch.stopNodes()
])

const verifyMessages = withAction('verify')
const testJwt = '12345678909876543210'
const verifyReq = verifyMessages.build({ jwt: testJwt })

const withJwtMessages = action => {
  const baseAction = withAction(action)
  const build = obj => baseAction.build(Object.assign({ jwt: testJwt }, obj))
  return { build }
}

beforeEach(() => {
  sessionMock.reset()
  setSessionMockUser()
})

const setSessionMockUser = (
  user = { id: registeredUser.id, email: registeredUser.email }
) => sessionMock.addMockFor(verifyReq, verifyMessages.ok({ user }))

afterEach(() => { sessionMock.errorCheck() })

module.exports = {
  startServices,
  stopServices,
  walletService,
  wsClient,
  withJwtMessages,
  sessionMock,
  setSessionMockUser,
  walletServiceConfig,
  chainsOrch
}
