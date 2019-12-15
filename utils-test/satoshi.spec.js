
const { units: { Satoshi }, dbconnection: { collection, connect } } = require('../utils')
const { TestDataSetup: { dropTestDatabase, dbConfig } } = require('../test-tools')

describe('Satoshi object', () => {
  const testcollection = collection('satoshitest')

  before(async () => {
    await connect(dbConfig)
    await dropTestDatabase()
  })

  it('create from string', () => {
    const strValue = '999999999999999999'
    const sat = Satoshi.fromString(strValue)
    sat.toString().should.equal(strValue)
  })

  it('create with constructor', () => {
    const sat = new Satoshi(-1486618625, 232830643)
    sat.toString().should.equal('999999999999999999')
  })

  it('return as BTC string', () => {
    Satoshi.fromString('123456789012345678')
      .toBtc().should.equal('1234567890.12345678')

    Satoshi.fromString('1').toBtc().should.equal('0.00000001')
    Satoshi.fromString('0').toBtc().should.equal('0.00000000')
    Satoshi.fromString('100000000').toBtc().should.equal('1.00000000')
  })

  it('return as BigInt', () => {
    (Satoshi.fromString('999999999999999999').toBigInt() === 999999999999999999n)
      .should.equal(true);

    (Satoshi.fromString('1').toBigInt() === 1n).should.equal(true);
    (Satoshi.fromString('0').toBigInt() === 0n).should.equal(true);
    (Satoshi.fromString('100000000').toBigInt() === 100000000n).should.equal(true)
  })

  it('constructor number > 18 digits not allowed', () => {
    (() => new Satoshi(-1486618624, 232830643)).should.throw(Error, 'value exceeds 18 digits: 1000000000000000000')
  })

  it('fromString number > 18 digits not allowed', () => {
    (() => Satoshi.fromString('1000000000000000000')).should.throw(Error, 'value exceeds 18 digits: 1000000000000000000')
  })

  it('fromString only allow whole number', () => {
    (() => Satoshi.fromString('1.1')).should.throw(Error, 'only digits allowed: 1.1')
  })

  it('fromString only allows digits', () => {
    (() => Satoshi.fromString('1,1')).should.throw(Error, 'only digits allowed: 1,1')
  })

  it('constructor negative numbers not allowed', () => {
    (() => new Satoshi(-1, -1)).should.throw(Error, 'negative value not allowed: -1')
  })

  it('fromString negative numbers not allowed', () => {
    (() => Satoshi.fromString('-1')).should.throw(Error, 'negative value not allowed: -1')
  })

  it('fromInt not allowed', () => {
    (() => Satoshi.fromInt(1234)).should.throw(Error, 'not supported, use "fromString"')
  })

  it('fromNumber not allowed', () => {
    (() => Satoshi.fromNumber(1234)).should.throw(Error, 'not supported, use "fromString"')
  })

  it('can store and retrieve from DB', async () => {
    const strValue = '999999999999999999'
    const saved = await testcollection.insertOne({ testval: Satoshi.fromString(strValue) })
    const doc = await testcollection.findOne({ _id: saved.insertedId })
    doc.testval.toString().should.equal(strValue)
  })
})
