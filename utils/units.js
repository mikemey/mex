const Long = require('mongodb').Long

const BTC_FRACTION_COUNT = 8
const BTC_MAX_VALUE = 1000000
const FROM_STRING_MAX_LEN = 18
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

  static fromNumber (num) { throw new Error('not supported, use "fromString"') }

  static fromString (value) {
    checkMax(value)
    const lval = Long.fromString(value)
    checkMin(lval)
    checkDigits(value)
    return new Satoshi(lval.low_, lval.high_)
  }

  static fromBtcValue (btcValue) {
    if (btcValue >= BTC_MAX_VALUE) { throw new Error(`too large: ${btcValue}`) }
    let btcStr = String(btcValue)
    const dotIndex = btcStr.indexOf('.')
    if ((btcStr.length - dotIndex - 1) > BTC_FRACTION_COUNT) { throw new Error(`invalid precision: ${btcValue}`) }
    btcStr = btcStr.replace('.', '')
    const satoshis = (dotIndex > 0)
      ? btcStr.padEnd(dotIndex + BTC_FRACTION_COUNT, '0')
      : `${btcStr}00000000`
    return this.fromString(satoshis)
  }

  toBigInt () { return BigInt(this.toString()) }

  toBtc () {
    const value = this.toString().padStart(BTC_FRACTION_COUNT + 1, '0')
    const whole = value.slice(0, -BTC_FRACTION_COUNT)
    const fraction = value.slice(-BTC_FRACTION_COUNT).replace(/[0]*$/, '')
    return fraction.length > 0
      ? `${whole}.${fraction}`
      : whole
  }
}

module.exports = { Satoshi }
