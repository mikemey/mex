const { assetsMetadata } = require('../metadata')

const supportedAssets = Object.keys(assetsMetadata)

const unitDefinitions = supportedAssets.reduce((units, symbol) => {
  units[symbol] = assetsMetadata[symbol].unit
  return units
}, {})

const check = symbol => {
  if (symbol === null || symbol === undefined) {
    throw new Error('unit conversion requires symbol')
  }
  if (!supportedAssets.includes(symbol)) {
    throw new Error(`unit conversion symbol not supported: ${symbol}`)
  }
}

const amountObj = (baseAmount, unit) => {
  return {
    toBaseUnit: () => baseAmount,
    toDefaultUnit: () => {
      const amt = baseAmount.padStart(unit.fractions + 1, '0')
      const whole = amt.slice(0, -unit.fractions)

      const fraction = amt
        .slice(whole.length, whole.length + unit.hrfractions)
        .padEnd(unit.hrfractions, '0')
      return `${whole}.${fraction}`
    }
  }
}

const fromAmount = (val, symbol) => {
  check(symbol)
  const valnum = Number(val)
  if (valnum < 0) {
    throw Error(`zero or negative value not allowed: ${val}`)
  }
  const unit = unitDefinitions[symbol]
  const baseAmount = valnum === 0
    ? '0'
    : valnum
      .toFixed(unit.fractions)
      .replace('.', '')
      .replace(/^[0]*/, '')

  return amountObj(baseAmount, unit)
}

const fromBaseAmount = (val, symbol) => {
  check(symbol)
  const unit = unitDefinitions[symbol]
  return amountObj(String(val), unit)
}

module.exports = { fromBaseAmount, fromAmount }
