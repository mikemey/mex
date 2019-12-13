// const BitcoinClient = require('bitcoin-core')

// const { TestDataSetup: { dropTestDatabase, registeredUser } } = require('../test-tools')
// const {
//   wsmessages: { OK_STATUS, ERROR_STATUS, withAction },
//   dbconnection: { collection, ObjectId }
// } = require('../utils')

// const {
//   startServices, stopServices, wsClient, withJwtMessages, sessionMock, createDepositAddress
// } = require('./wallet.orch')

// const { faucetWallet, walletConfig, generateBlocks } = require('./btcnode.orch')

// describe('Wallet depositer', () => {
//   const mexWallet = new BitcoinClient(walletConfig())
//   const addressColl = collection('addresses')

//   const addressMsgs = withJwtMessages('address')
//   const regUserAddressReq = () => addressMsgs.build({ asset: 'btc' })

//   before(startServices)
//   after(stopServices)
//   beforeEach(async () => {
//     await dropTestDatabase()
//     await createDepositAddress()
//   })
//   afterEach(() => wsClient.stop())

//   const pause = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))
//   const sendAndConfirmTx = async (address, amount) => {
//     console.log('====== sendToAddress', address)
//     await faucetWallet.sendToAddress(address, amount)
//     await generateBlocks(1)
//     // pause(2000)
//     // await generateBlocks(1)
//     // pause(2000)
//     // await generateBlocks(1)
//   }

//   describe('requesting address', () => {
//     it('generate new address for new user', async () => {
//       const testUserId = '5def654c9ad3f153493e3bbb'
//       const testJwt = 'bla-bla-bla-bla-bla-bla'

//       const verifyMessages = withAction('verify')
//       const verifyReq = verifyMessages.build({ jwt: testJwt })
//       const verifyRes = verifyMessages.ok({ user: { id: testUserId } })
//       sessionMock.reset()
//       sessionMock.addMockFor(verifyReq, verifyRes)

//       const addressReq = withJwtMessages('address', testJwt).build({ asset: 'btc' })
//       const addressResponse = await wsClient.send(addressReq)

//       addressResponse.status.should.equal(OK_STATUS)
//       addressResponse.action.should.equal('address')

//       const addressInfo = await mexWallet.getAddressInfo(addressResponse.address)
//       addressInfo.ismine.should.equal(true)

//       const storedAddress = await addressColl.findOne({ _id: ObjectId(testUserId) })
//       storedAddress.reserved.should.deep.equal([
//         { asset: 'btc', address: addressResponse.address }
//       ])
//     })
//     it('returns existing address for existing user', async () => {
//       const address = 'overwritten-address'
//       await addressColl.updateOne({ _id: ObjectId(registeredUser.id) },
//         { $set: { reserved: [{ asset: 'btc', address }] } }
//       )
//       const addressResponse = await wsClient.send(regUserAddressReq())
//       addressResponse.status.should.equal(OK_STATUS)
//       addressResponse.address.should.equal(address)
//     })

//     it('broadcasts address received funding', async () => {
//       const receivedBroadcast = []
//       let broadcastCount = 0
//       const subscribeRes = await wsClient.subscribe('address-funding', (topic, message) => {
//         broadcastCount += 1
//         topic.should.equal('address-funding')
//         receivedBroadcast.push(message)
//       })
//       subscribeRes.status.should.equal(OK_STATUS)

//       const res = await wsClient.send(regUserAddressReq())
//       console.log('address RESPONSE:')
//       console.log(res)
//       const address = res.address
//       const firstTxAmount = '1.23'
//       await sendAndConfirmTx(address, firstTxAmount)
//       await pause(1500)
//       broadcastCount.should.equal(1)
//       receivedBroadcast.should.deep.equal([{ address, amount: firstTxAmount }])

//       const secondTxAmount = '0.23'
//       await sendAndConfirmTx(address, secondTxAmount)
//       broadcastCount.should.equal(2)
//       receivedBroadcast.should.deep.equal([
//         { address, amount: firstTxAmount },
//         { address, amount: secondTxAmount }
//       ])
//     }, 30000)
//   })

//   describe('client errors', () => {
//     const expectNewAddressError = async (changeReq = _ => { }) => {
//       const req = regUserAddressReq()
//       changeReq(req)
//       const res = await wsClient.send(req)
//       const errorMessage = Object.assign({
//         user: { id: registeredUser.id, email: registeredUser.email }
//       }, req)
//       delete errorMessage.jwt
//       res.should.deep.equal({ status: ERROR_STATUS, message: errorMessage })
//     }

//     it('missing action parameter', () => expectNewAddressError(req => { delete req.action }))
//     it('invalid action', () => expectNewAddressError(req => { req.action = 'addressX' }))
//     it('missing action parameter', () => expectNewAddressError(req => { delete req.action }))
//     it('empty asset', () => expectNewAddressError(req => { req.asset = '' }))
//     it('unkown asset', () => expectNewAddressError(req => { req.asset = 'ukn' }))
//     it('additional request parameters', () => expectNewAddressError(req => { req.additional = 'param' }))
//   })
// })

// it.only('dbtesting', async () => {
//   const coll = dbconnection.collection('adtest')
//   await coll.insertMany([
//     { address: '1', txs: [] },
//     { address: '2', txs: [] },
//     { address: '3', txs: [{ txid: 't2', block: 5 }] }
//   ])
//   await printdata()
//   await coll.bulkWrite([
//     { updateOne: { filter: { address: '2' }, update: { $addToSet: { txs: { txid: 't1', block: null } } } } },
//     { updateOne: { filter: { address: '3' }, update: { $addToSet: { txs: { txid: 't3', block: null } } } } },
//     { updateOne: { filter: { address: '4' }, update: { $addToSet: { txs: { txid: 'nope', block: null } } } } }
//   ])

//   await printdata()
//   await coll.bulkWrite([
//     { updateOne: { filter: { address: '2' }, update: { $addToSet: { txs: { txid: 't1', block: null } } } } },
//     { updateOne: { filter: { address: '2', 'txs.txid': 't1' }, update: { $set: { 'txs.$.block': 6 } } } },
//     { updateOne: { filter: { address: '3' }, update: { $addToSet: { txs: { txid: 't3', block: null } } } } },
//     { updateOne: { filter: { address: '3', 'txs.txid': 't3' }, update: { $set: { 'txs.$.block': 6 } } } },
//     { updateOne: { filter: { address: '44' }, update: { $addToSet: { txs: { txid: 'nope', block: null } } } } },
//     { updateOne: { filter: { address: '44', 'txs.txid': 't1' }, update: { $set: { 'txs.$.block': 6 } } } },
//     { updateOne: { filter: { address: '1' }, update: { $addToSet: { txs: { txid: 't7', block: null } } } } },
//     { updateOne: { filter: { address: '1', 'txs.txid': 't7' }, update: { $set: { 'txs.$.block': 6 } } } }
//   ])
//   await printdata()
// })
// const printdata = async () => {
//   const data = await dbconnection.collection('adtest').find({})
//   data.forEach(d => {
//     console.log('------------------------------')
//     console.log(d)
//   })
//   console.log('=================================================================================')
// }
