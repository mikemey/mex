const Long = require('mongodb').Long

const BTC_FRACTION_COUNT = 8
const FROM_STRING_MAX_LEN = 18
const FROM_NUMBER_MAX_LEN = 999999999999999
const SATOSHI_MIN = Long.fromInt(0)

const checkMax = strValue => {
  if (strValue.length > FROM_STRING_MAX_LEN) {
    throw new Error(`value exceeds 18 digits: ${strValue}`)
  }
}

const checkMin = longValue => {
  if (longValue.lessThan(SATOSHI_MIN)) { return negativeValueError(longValue) }
}

const negativeValueError = num => { throw new Error(`negative value not allowed: ${num.toString()}`) }

const checkDigits = strValue => {
  if (!/^\d+$/.test(strValue)) { throw new Error(`only digits allowed: ${strValue}`) }
}

class Satoshi extends Long {
  constructor (low, high) {
    if (low === undefined || high === undefined) { throw new Error('Statoshi constructor requires 2 arguments (lowBits, highBits)') }
    super(low, high)
    checkMax(this.toString())
    checkMin(this)
  }

  static fromInt () { throw new Error('not supported, use "fromString"') }

  static fromNumber (num) {
    if (num < 0) { return negativeValueError(num) }
    if (num % 1 !== 0) { throw new Error(`only whole numbers: ${num}`) }
    if (num > FROM_NUMBER_MAX_LEN) {
      throw new Error(`value exceeds 15 digits (when converting from number): ${num}`)
    }
    // return this.fromString(`000${num}`)
    return super.fromNumber(num)
  }

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
    const value = this.toString().padStart(BTC_FRACTION_COUNT + 1, '0')
    const whole = value.slice(0, -BTC_FRACTION_COUNT)
    const fraction = value.slice(-BTC_FRACTION_COUNT)
    return `${whole}.${fraction}`
  }
}

module.exports = { Satoshi }
