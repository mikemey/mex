const TestData = require('../test-tools/test-data-setup')
const { faucetWallet, thirdPartyWallet, generateBlocksWithInfo } = require('../wallet-test/chains/btc-node.orch')

const sendToAddress = ({ address, amount }) => faucetWallet.sendToAddress(address, amount)

const generateUnrelatedTxs = () => Promise.all([
  [faucetWallet, thirdPartyWallet, '1.1'],
  [thirdPartyWallet, faucetWallet, '0.3']
].map(([sender, receiver, btcs]) => receiver.getNewAddress()
  .then(addr => sender.sendToAddress(addr, btcs))
))

module.exports = (on, config) => {
  on('task', {
    dropTestDatabase: TestData.dropTestDatabase,
    seedTestData: TestData.seedTestData,
    getRegisteredUser: () => TestData.registeredUser,
    sendToAddress,
    generateUnrelatedTxs,
    generateBlocksWithInfo
  })
}
