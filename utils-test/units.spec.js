const { UnitType } = require('number-unit')

const { units: { amountFrom }, dbconnection } = require('../utils')
const { TestDataSetup: { dropTestDatabase, dbConfig } } = require('../test-tools')

describe('Units conversion', () => {

  const testUnitsOverride = {
    btc: {
      fractions: 8,
      type: UnitType.create('bitcoin', null, { satoshi: 1, btc: 1e8 }, 'satoshi')
    },
    eth: {
      fractions: 4,
      type: UnitType.create('ethereum', null, { wei: 1e-15, pwei: 1, eth: 1e3 }, 'pwei')
    }
  }

  const testAmountFrom = (val, symbol = 'btc') => amountFrom(val, symbol, testUnitsOverride)

  describe.only('amountFrom', () => {
    const testdata = [
      { input: 999999.99999999, symbol: 'btc', base: '99999999999999', defaultUnit: '999999.99999999' },
      { input: 0.23456789, symbol: 'btc', base: '23456789', defaultUnit: '0.23456789' },
      { input: 0.000001, symbol: 'btc', base: '100', defaultUnit: '0.00000100' },
      { input: 1, symbol: 'btc', base: '100000000', defaultUnit: '1.00000000' },
      { input: 1.00000000, symbol: 'btc', base: '100000000', defaultUnit: '1.00000000' },
      { input: 0.9, symbol: 'btc', base: '90000000', defaultUnit: '0.90000000' },
      { input: 999999, symbol: 'btc', base: '99999900000000', defaultUnit: '999999.00000000' },

      { input: 1, symbol: 'eth', base: '1000', defaultUnit: '1.0000' },
      { input: 999999.99999999, symbol: 'eth', base: '999999999.99999', defaultUnit: '999999.9999' },
      { input: 0.001, symbol: 'eth', base: '1', defaultUnit: '0.0010' },
      { input: 0.123, symbol: 'eth', base: '123', defaultUnit: '0.1230' }
    ]

    testdata.forEach(({ input, symbol, base, defaultUnit }, ix) => {
      it(`numbers ${input} --> ${base}`, () => testValue(input))
      it(`strings ${input} --> ${base}`, () => testValue(String(input)))

      const testValue = testInput => {
        const amount = testAmountFrom(testInput, symbol)
        amount.toBaseUnit().should.equal(base)
        amount.toDefaultUnit().should.equal(defaultUnit)
      }
    })

    it('scientific notation not supported', () => {
      (() => testAmountFrom('0.0000000000000001')).should.throw(Error, 'scientific notation not supported: 1e-16')
    })

    it('negative numbers not allowed', () => {
      (() => testAmountFrom('-1')).should.throw(Error, 'zero or negative value not allowed: -1')
    })

    it('zero not allowed', () => {
      (() => testAmountFrom('0')).should.throw(Error, 'zero or negative value not allowed: 0')
    })

    // it('strings', () => {
    //   const val = '999999999999999999'
    //   const maxBtcs = unitFrom('999999999999999999', 'btc')
    //   maxBtcs.toBase().should.equal(val)
    //   maxBtcs.toUnit().should.equal('9999999999.99999999')

    //   unitFrom(val, 'btc').toBase().should.equal(val)
    //   const strValue = '999999999999999999'
    //   testUnitFrom(strValue).toString().should.equal(strValue)
    // })

    // it('numbers', () => {
    //   unitFrom('999999999999999999', 'satoshi')
    //   const strValue = '999999999999999999'
    //   Satoshi.fromString(strValue).toString().should.equal(strValue)
    // })

    // it('number > 18 digits not allowed', () => {
    //   (() => Satoshi.fromString('1000000000000000000')).should.throw(Error, 'value exceeds 18 digits: 1000000000000000000')
    // })

    // it('only allow whole number', () => {
    //   (() => Satoshi.fromString('1.1')).should.throw(Error, 'only digits allowed: 1.1')
    // })

    // it('only allows digits', () => {
    //   (() => Satoshi.fromString('1,1')).should.throw(Error, 'only digits allowed: 1,1')
    // })

    // it('negative numbers not allowed', () => {
    //   (() => Satoshi.fromString('-1')).should.throw(Error, 'negative value not allowed: -1')
    // })
  })

  describe.only('baseAmountFrom', () => {
  })
  // describe('fromBtcValue', () => {
  //   it('valid create', () => {
  //     Satoshi.fromBtcValue(1.234).toString().should.equal('123400000')
  //     Satoshi.fromBtcValue(1).toString().should.equal('100000000')
  //     Satoshi.fromBtcValue(1.0).toString().should.equal('100000000')
  //     Satoshi.fromBtcValue(1.1).toString().should.equal('110000000')
  //     Satoshi.fromBtcValue(0.001).toString().should.equal('100000')
  //     Satoshi.fromBtcValue(0.0000054).toString().should.equal('540')
  //     Satoshi.fromBtcValue(999999.99999999).toString().should.equal('99999999999999')
  //     Satoshi.fromBtcValue(999999).toString().should.equal('99999900000000')
  //   })

  //   it('precision > 8 not allowed', () => {
  //     (() => Satoshi.fromBtcValue(1.123456789)).should.throw(Error, 'invalid precision: 1.123456789')
  //   })

  //   it('btc >= 1 million not allowed', () => {
  //     (() => Satoshi.fromBtcValue(1000000)).should.throw(Error, 'too large: 1000000')
  //   })

  //   it('negative btc not allowed', () => {
  //     (() => Satoshi.fromBtcValue(-1)).should.throw(Error, 'negative value not allowed: -1')
  //   })
  // })

  // describe('convert value', () => {
  //   it('to BTC string', () => {
  //     Satoshi.fromString('123456789012345678')
  //       .toBtc().should.equal('1234567890.12345678')

  //     Satoshi.fromString('1').toBtc().should.equal('0.00000001')
  //     Satoshi.fromString('0').toBtc().should.equal('0')
  //     Satoshi.fromString('100000000').toBtc().should.equal('1')
  //   })

  //   it('to/from BTC string', () => {
  //     Satoshi.fromBtcValue(1.234).toBtc().should.equal('1.234')
  //     Satoshi.fromBtcValue(1).toBtc().should.equal('1')
  //     Satoshi.fromBtcValue(1.0).toBtc().should.equal('1')
  //     Satoshi.fromBtcValue(1.1).toBtc().should.equal('1.1')
  //     Satoshi.fromBtcValue(0.001).toBtc().should.equal('0.001')
  //     Satoshi.fromBtcValue(0.0000054).toBtc().should.equal('0.0000054')
  //     Satoshi.fromBtcValue(999999.99999999).toBtc().should.equal('999999.99999999')
  //     Satoshi.fromBtcValue(999999).toBtc().should.equal('999999')
  //   })

  //   it('to BigInt', () => {
  //     (Satoshi.fromString('999999999999999999').toBigInt() === 999999999999999999n)
  //       .should.equal(true);

  //     (Satoshi.fromString('1').toBigInt() === 1n).should.equal(true);
  //     (Satoshi.fromString('0').toBigInt() === 0n).should.equal(true);
  //     (Satoshi.fromString('100000000').toBigInt() === 100000000n).should.equal(true)
  //   })
  // })

  // describe('illegal create functions', () => {
  //   it('fromInt not allowed', () => {
  //     (() => Satoshi.fromInt(1234)).should.throw(Error, 'not supported, use "fromString"')
  //   })

  //   it('fromNumber not allowed', () => {
  //     (() => Satoshi.fromNumber(1234)).should.throw(Error, 'not supported, use "fromString"')
  //   })
  // })

  xdescribe('store in db', () => {
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
