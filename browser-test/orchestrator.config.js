const dbConfig = { url: 'mongodb://127.0.0.1:27017', name: 'mex-test' }

const authToken = 'e2e-token-7567812341'
const sessionServiceConfig = {
  wsserver: { path: '/session', port: 13043, authorizedTokens: [authToken] },
  db: dbConfig
}

const useraccountConfig = { path: '/uac', port: 13500 }
const useraccountSessionClientConfig = {
  url: `ws://localhost:${sessionServiceConfig.wsserver.port}${sessionServiceConfig.wsserver.path}`,
  authToken,
  timeout: 2000
}

module.exports = {
  dbConfig, useraccountConfig, useraccountSessionClientConfig, sessionServiceConfig
}
