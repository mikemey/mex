const { units: { fromAmount, fromBaseAmount }, dbconnection } = require('../utils')
const { TestDataSetup: { dropTestDatabase, dbConfig } } = require('../test-tools')

describe('Units conversion', () => {
  const testFromAmount = (val, symbol = 'btc') => fromAmount(val, symbol)

  const testdata = [
    { symbol: 'btc', input: '9999999.99999999', base: '999999999999999', defaultUnit: '9999999.99999999' },
    { symbol: 'btc', input: '0.23456789', base: '23456789', defaultUnit: '0.23456789' },
    { symbol: 'btc', input: '0.00000001', base: '1', defaultUnit: '0.00000001' },
    { symbol: 'btc', input: '1', base: '100000000', defaultUnit: '1.00000000' },
    { symbol: 'btc', input: '1.00000000', base: '100000000', defaultUnit: '1.00000000' },
    { symbol: 'btc', input: '0.9', base: '90000000', defaultUnit: '0.90000000' },
    { symbol: 'btc', input: '0.009', base: '900000', defaultUnit: '0.00900000' },
    { symbol: 'btc', input: '9999999', base: '999999900000000', defaultUnit: '9999999.00000000' },
    { symbol: 'btc', input: '0', base: '0', defaultUnit: '0.00000000' },

    { symbol: 'eth', input: '1', base: '1000000000', defaultUnit: '1.000000' },
    { symbol: 'eth', input: '999999.999999999', base: '999999999999999', defaultUnit: '999999.999999' },
    { symbol: 'eth', input: '0.000001', base: '1000', defaultUnit: '0.000001' },
    { symbol: 'eth', input: '0.000000001', base: '1', defaultUnit: '0.000000' },
    { symbol: 'eth', input: '0.123', base: '123000000', defaultUnit: '0.123000' }
  ]

  testdata.forEach(({ input, symbol, base, defaultUnit }) => {
    it(`fromAmount(number).toBaseUnit ${input} ${symbol} --> ${base}`, () =>
      testFromAmount(Number(input), symbol).toBaseUnit().should.equal(base)
    )
    it(`fromAmount(string).toBaseUnit ${input} ${symbol} --> ${base}`, () =>
      testFromAmount(input, symbol).toBaseUnit().should.equal(base)
    )
    it(`fromAmount(number).toDefaultUnit ${input} ${symbol} --> ${defaultUnit}`, () =>
      testFromAmount(Number(input), symbol).toDefaultUnit().should.equal(defaultUnit)
    )
    it(`fromAmount(string).toDefaultUnit ${input} ${symbol} --> ${defaultUnit}`, () =>
      testFromAmount(input, symbol).toDefaultUnit().should.equal(defaultUnit)
    )

    it(`fromBaseAmount ${base} --> ${defaultUnit}`, () => {
      const amount = fromBaseAmount(base, symbol)
      amount.toBaseUnit().should.equal(base)
      amount.toDefaultUnit().should.equal(defaultUnit)
    })
  })

  it('negative numbers not allowed', () => {
    (() => testFromAmount('-1')).should.throw(Error, 'zero or negative value not allowed: -1')
  })

  it('fromAmount throws error when no symbol', () => {
    (() => fromAmount('1')).should.throw(Error, 'unit conversion requires symbol')
  })

  it('fromAmount throws error for unsupported symbol', () => {
    (() => fromAmount('1', 'unknown')).should.throw(Error, 'unit conversion symbol not supported: unknown')
  })

  it('fromBaseAmount throws error when no symbol', () => {
    (() => fromBaseAmount('1')).should.throw(Error, 'unit conversion requires symbol')
  })

  it('fromBaseAmount throws error for unsupported symbol', () => {
    (() => fromBaseAmount('1', 'unknown')).should.throw(Error, 'unit conversion symbol not supported: unknown')
  })

  describe('store in db', () => {
    const testcollection = dbconnection.collection('unittest')

    before(async () => {
      await dbconnection.connect(dbConfig)
      await dropTestDatabase()
    })
    after(dbconnection.close)

    it('can store and retrieve', async () => {
      const incomingAmount = fromAmount('3.4567', 'btc')

      const saved = await testcollection.insertOne({ testval: incomingAmount.toBaseUnit() })
      const doc = await testcollection.findOne({ _id: saved.insertedId })

      const storedAmount = fromBaseAmount(doc.testval, 'btc')
      storedAmount.toBaseUnit().should.equal('345670000')
      storedAmount.toDefaultUnit().should.equal('3.45670000')
    })
  })
})
