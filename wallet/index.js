const BitcoinClient = require('bitcoin-core')

const { WSSecureServer } = require('../connectors')
const { wsmessages: { withAction } } = require('../utils')

const newAddressMessages = withAction('newaddress')

class WalletService extends WSSecureServer {
  constructor (config) {
    const btcClientConfig = config.btcClient
    delete config.btcClient
    super(config)

    this.btcWallet = new BitcoinClient(btcClientConfig)
  }

  async secureReceived (request) {
    const address = await this.btcWallet.getNewAddress()
    return newAddressMessages.ok({ address })
  }
}

module.exports = WalletService
