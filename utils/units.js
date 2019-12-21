const { UnitType } = require('number-unit')

const { assetsMetadata } = require('../metadata')

const unitDefinitions = Object.keys(assetsMetadata).reduce((units, symbol) => {
  units[symbol] = { fractions: assetsMetadata[symbol].fractions }
  return units
}, {})

unitDefinitions.btc.type = UnitType.create('bitcoin', null, { satoshi: 1, btc: 1e8 }, 'satoshi')
unitDefinitions.btc.zero = unitDefinitions.btc.type.btc(0)
console.log(unitDefinitions.btc.zero.toString())

const getUnitType = symbol => unitDefinitions[symbol].type

const plainToString = obj => obj.toString({ unit: false })

const amountObj = (amount, symbol, fractions) => {
  return {
    toBaseUnit: () => plainToString(amount.toBase()),
    toDefaultUnit: () => {
      const asStr = plainToString(amount.to(symbol))
      const dotIndex = asStr.indexOf('.')
      const totalLength = dotIndex + fractions + 1
      return dotIndex > 0
        ? asStr.substring(0, totalLength).padEnd(totalLength, '0')
        : `${asStr}.${'0'.repeat(fractions)}`
    }
  }
}

const amountFrom = (val, symbol, definitions = unitDefinitions) => {
  const unitDef = definitions[symbol]
  const amount = unitDef.type[symbol](val)
  if (plainToString(amount).includes('e')) {
    throw Error(`scientific notation not supported: ${plainToString(amount)}`)
  }
  const zero = unitDef.type[symbol](0)
  if (amount.lte(zero)) {
    throw Error(`zero or negative value not allowed: ${plainToString(amount)}`)
  }

  return amountObj(amount, symbol, unitDef.fractions)
}

const baseFrom = (val, symbol, definitions = unitDefinitions) => {

}

module.exports = { getUnitType, amountFrom }
