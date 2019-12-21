const { UnitType } = require('number-unit')

const { units: { amountFrom, baseAmountFrom }, dbconnection } = require('../utils')
const { TestDataSetup: { dropTestDatabase, dbConfig } } = require('../test-tools')

describe.only('Units conversion', () => {
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

  testdata.forEach(({ input, symbol, base, defaultUnit }) => {
    it(`amountFrom numbers ${input} --> ${base}`, () => testValue(input))
    it(`amountFrom strings ${input} --> ${base}`, () => testValue(String(input)))

    it(`baseAmountFrom ${base} --> ${defaultUnit}`, () => {
      const amount = baseAmountFrom(base, symbol, testUnitsOverride)
      amount.toDefaultUnit().should.equal(defaultUnit)
    })

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

  it('amountFrom throws error when no symbol', () => {
    (() => amountFrom('1')).should.throw(Error, 'unit conversion requires symbol')
  })

  it('amountFrom throws error for unsupported symbol', () => {
    (() => amountFrom('1', 'unknown')).should.throw(Error, 'unit conversion symbol not supported: unknown')
  })

  it('baseAmountFrom throws error when no symbol', () => {
    (() => baseAmountFrom('1')).should.throw(Error, 'unit conversion requires symbol')
  })

  it('baseAmountFrom throws error for unsupported symbol', () => {
    (() => baseAmountFrom('1', 'unknown')).should.throw(Error, 'unit conversion symbol not supported: unknown')
  })

  describe('store in db', () => {
    const testcollection = dbconnection.collection('unittest')

    before(async () => {
      await dbconnection.connect(dbConfig)
      await dropTestDatabase()
    })
    after(dbconnection.close)

    it('can store and retrieve', async () => {
      const incomingAmount = amountFrom('3.4567', 'btc')

      const saved = await testcollection.insertOne({ testval: incomingAmount.toBaseUnit() })
      const doc = await testcollection.findOne({ _id: saved.insertedId })

      const storedAmount = baseAmountFrom(doc.testval, 'btc', testUnitsOverride)
      storedAmount.toBaseUnit().should.equal('345670000')
      storedAmount.toDefaultUnit().should.equal('3.45670000')
    })
  })
})
