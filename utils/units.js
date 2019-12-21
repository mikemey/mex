const { UnitType } = require('number-unit')

const { assetsMetadata } = require('../metadata')

const supportedAssets = Object.keys(assetsMetadata)

const unitDefinitions = supportedAssets.reduce((units, symbol) => {
  units[symbol] = { fractions: assetsMetadata[symbol].fractions }
  return units
}, {})

unitDefinitions.btc.type = UnitType.create('bitcoin', null, { satoshi: 1, btc: 1e8 }, 'satoshi')

const check = symbol => {
  if (symbol === null || symbol === undefined) {
    throw new Error('unit conversion requires symbol')
  }
  if (!supportedAssets.includes(symbol)) {
    throw new Error(`unit conversion symbol not supported: ${symbol}`)
  }
}

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
  check(symbol)
  const unitDef = definitions[symbol]
  const unit = unitDef.type
  const amount = unit[symbol](val)

  if (plainToString(amount).includes('e')) {
    throw Error(`scientific notation not supported: ${plainToString(amount)}`)
  }

  if (amount.lte(unit.ZERO)) {
    throw Error(`zero or negative value not allowed: ${plainToString(amount)}`)
  }

  return amountObj(amount, symbol, unitDef.fractions)
}

const baseAmountFrom = (val, symbol, definitions = unitDefinitions) => {
  check(symbol)
  const unitDef = definitions[symbol]
  const amount = unitDef.type.baseUnit(val)
  return amountObj(amount, symbol, unitDef.fractions)
}

module.exports = { baseAmountFrom, amountFrom }
