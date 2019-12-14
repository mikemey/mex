const chains = require('../../wallet/chains')

describe('Chain module', () => {
  const supportedAssets = ['btc']

  supportedAssets.forEach(asset => {
    it('returns known chains', () => {
      const chain = chains.getChain(asset)
      chain.symbol.should.equal(asset)
      chain.should.have.property('start')
    })
  })

  it('throws error for unknown assets', () => {
    const unknownAsset = 'unknown';
    (() => chains.getChain(unknownAsset)).should.throw(Error, 'chain not supported: ' + unknownAsset)
  })
})
