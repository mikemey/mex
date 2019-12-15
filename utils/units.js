const Long = require('mongodb').Long

const BTCFRACTIONCOUNT = 8
const SATOSHI_MIN = Long.fromInt(0)

const checkMax = strValue => {
  if (strValue.length > 18) { throw new Error(`value exceeds 18 digits: ${strValue}`) }
}

const checkMin = longValue => {
  if (longValue.lessThan(SATOSHI_MIN)) { throw new Error(`negative value not allowed: ${longValue.toString()}`) }
}

const checkDigits = strValue => {
  if (!/^\d+$/.test(strValue)) { throw new Error(`only digits allowed: ${strValue}`) }
}

class Satoshi extends Long {
  constructor (low, high) {
    super(low, high)
    checkMax(this.toString())
    checkMin(this)
  }

  static fromInt () { throw new Error('not supported, use "fromString"') }
  static fromNumber () { throw new Error('not supported, use "fromString"') }
  static fromString (value) {
    checkMax(value)
    const lval = Long.fromString(value)
    checkMin(lval)
    checkDigits(value)
    return new Satoshi(lval.low_, lval.high_)
  }

  toString () { return super.toString() }

  toBigInt () { return BigInt(this.toString()) }

  toBtc () {
    const amt = this.toString().padStart(BTCFRACTIONCOUNT + 1, '0')
    const whole = amt.slice(0, -BTCFRACTIONCOUNT)
    const fraction = amt.slice(-BTCFRACTIONCOUNT)
    return `${whole}.${fraction}`
  }
}

module.exports = { Satoshi }
