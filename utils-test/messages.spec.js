const { messages: { broadcastAddressFor } } = require('../utils')

describe('Messages', () => {
  describe('broadcast addresses', () => {
    it('create broadcast address for ipc', async () => {
      broadcastAddressFor('ipc:///tmp/bla').should.equal('ipc:///tmp/bla_bc')
    })

    it('create broadcast address for tcp', async () => {
      broadcastAddressFor('tcp://127.0.0.1:3000').should.equal('tcp://127.0.0.1:3010')
    })

    it('throws error for unsupported protocol', async () => {
      (() => broadcastAddressFor('bla://127.0.0.1:3000')).should.throw(Error, 'unsupported protocol: "bla"')
    })
  })
})
