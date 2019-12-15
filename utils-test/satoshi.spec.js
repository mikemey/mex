
const { units: { Satoshi }, dbconnection } = require('../utils')
const { TestDataSetup: { dropTestDatabase, dbConfig } } = require('../test-tools')

describe('Satoshi', () => {
  describe('fromString', () => {
    it('valid create', () => {
      const strValue = '999999999999999999'
      Satoshi.fromString(strValue).toString().should.equal(strValue)
    })

    it('number > 18 digits not allowed', () => {
      (() => Satoshi.fromString('1000000000000000000')).should.throw(Error, 'value exceeds 18 digits: 1000000000000000000')
    })

    it('only allow whole number', () => {
      (() => Satoshi.fromString('1.1')).should.throw(Error, 'only digits allowed: 1.1')
    })

    it('only allows digits', () => {
      (() => Satoshi.fromString('1,1')).should.throw(Error, 'only digits allowed: 1,1')
    })

    it('negative numbers not allowed', () => {
      (() => Satoshi.fromString('-1')).should.throw(Error, 'negative value not allowed: -1')
    })
  })

  describe('create with constructor', () => {
    it('valid create', () => {
      const sat = new Satoshi(-1486618625, 232830643)
      sat.toString().should.equal('999999999999999999')
    })

    it('number > 18 digits not allowed', () => {
      (() => new Satoshi(-1486618624, 232830643)).should.throw(Error, 'value exceeds 18 digits: 1000000000000000000')
    })

    it('requires 2 args', () => {
      (() => new Satoshi('9.9')).should.throw(Error, 'Statoshi constructor requires 2 arguments (lowBits, highBits)');
      (() => new Satoshi()).should.throw(Error, 'Statoshi constructor requires 2 arguments (lowBits, highBits)')
    })

    it('negative numbers not allowed', () => {
      (() => new Satoshi(-1, -1)).should.throw(Error, 'negative value not allowed: -1')
    })
  })

  describe('fromBtcValue', () => {
    it('valid create', () => {
      Satoshi.fromBtcValue(1.234).toString().should.equal('123400000')
      Satoshi.fromBtcValue(1).toString().should.equal('100000000')
      Satoshi.fromBtcValue(1.0).toString().should.equal('100000000')
      Satoshi.fromBtcValue(1.1).toString().should.equal('110000000')
      Satoshi.fromBtcValue(0.001).toString().should.equal('100000')
      Satoshi.fromBtcValue(0.0000054).toString().should.equal('540')
      Satoshi.fromBtcValue(999999.99999999).toString().should.equal('99999999999999')
      Satoshi.fromBtcValue(999999).toString().should.equal('99999900000000')
    })

    it('precision > 8 not allowed', () => {
      (() => Satoshi.fromBtcValue(1.123456789)).should.throw(Error, 'invalid precision: 1.123456789')
    })

    it('btc >= 1 million not allowed', () => {
      (() => Satoshi.fromBtcValue(1000000)).should.throw(Error, 'too large: 1000000')
    })

    it('negative btc not allowed', () => {
      (() => Satoshi.fromBtcValue(-1)).should.throw(Error, 'negative value not allowed: -1')
    })
  })

  describe('convert value', () => {
    it('to BTC string', () => {
      Satoshi.fromString('123456789012345678')
        .toBtc().should.equal('1234567890.12345678')

      Satoshi.fromString('1').toBtc().should.equal('0.00000001')
      Satoshi.fromString('0').toBtc().should.equal('0')
      Satoshi.fromString('100000000').toBtc().should.equal('1')
    })

    it('to/from BTC string', () => {
      Satoshi.fromBtcValue(1.234).toBtc().should.equal('1.234')
      Satoshi.fromBtcValue(1).toBtc().should.equal('1')
      Satoshi.fromBtcValue(1.0).toBtc().should.equal('1')
      Satoshi.fromBtcValue(1.1).toBtc().should.equal('1.1')
      Satoshi.fromBtcValue(0.001).toBtc().should.equal('0.001')
      Satoshi.fromBtcValue(0.0000054).toBtc().should.equal('0.0000054')
      Satoshi.fromBtcValue(999999.99999999).toBtc().should.equal('999999.99999999')
      Satoshi.fromBtcValue(999999).toBtc().should.equal('999999')
    })

    it('to BigInt', () => {
      (Satoshi.fromString('999999999999999999').toBigInt() === 999999999999999999n)
        .should.equal(true);

      (Satoshi.fromString('1').toBigInt() === 1n).should.equal(true);
      (Satoshi.fromString('0').toBigInt() === 0n).should.equal(true);
      (Satoshi.fromString('100000000').toBigInt() === 100000000n).should.equal(true)
    })
  })

  describe('illegal create functions', () => {
    it('fromInt not allowed', () => {
      (() => Satoshi.fromInt(1234)).should.throw(Error, 'not supported, use "fromString"')
    })

    it('fromNumber not allowed', () => {
      (() => Satoshi.fromNumber(1234)).should.throw(Error, 'not supported, use "fromString"')
    })
  })

  describe('store in db', () => {
    const testcollection = dbconnection.collection('satoshitest')

    before(async () => {
      await dbconnection.connect(dbConfig)
      await dropTestDatabase()
    })
    after(dbconnection.close)

    it('can store and retrieve', async () => {
      const strValue = '999999999999999999'
      const saved = await testcollection.insertOne({ testval: Satoshi.fromString(strValue) })
      const doc = await testcollection.findOne({ _id: saved.insertedId })
      doc.testval.toString().should.equal(strValue)
    })
  })
})
