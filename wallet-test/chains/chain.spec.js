const chains = require('../../wallet/chains')
const btcnodeOrch = require('../chains/btc-node.orch')

describe('Chains module', () => {
  const chainsConfig = { btcnode: btcnodeOrch.defaultBtcAdapterConfig }

  describe('getChainAdapter', () => {
    beforeEach(() => chains.createAll(chainsConfig))
    afterEach(() => chains.stopAll())

    const supportedAssets = ['btc']

    supportedAssets.forEach(asset => {
      it('returns known chains', () => {
        const chain = chains.getChainAdapter(asset)

        chain.should.have.property('startListener')
        chain.should.have.property('stopListener')
        chain.should.have.property('createNewAddress')
      })
    })
  })

  describe('usage error', () => {
    it('throws error when adapters not created', () => {
      (() => chains.getChainAdapter('whateva')).should.throw(Error, /^chain adapters not created$/)
    })

    it('throws error for unknown assets', () => {
      chains.createAll(chainsConfig)
      const unknownAsset = 'unknown';
      (() => chains.getChainAdapter(unknownAsset)).should.throw(Error, RegExp(`^chain not supported: ${unknownAsset}$`))
    })
  })

  describe('configuration errors', () => {
    const testParameters = [
      { title: 'missing btcnode configuration', changeConfig: cfg => delete cfg.btcnode, error: '"btcnode" is required' }
    ]

    testParameters.forEach(params => {
      it(params.title, () => {
        const config = {
          btcnode: { does: 'not-matter' }
        }

        params.changeConfig(config);
        (() => chains.createAll(config)).should.throw(Error, params.error)
      })
    })
  })
})
