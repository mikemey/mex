const { randomString } = require('../utils')

const sensibleLimit = 16
const randNum = (maxLen = 6) => {
  const len = maxLen > sensibleLimit ? sensibleLimit : maxLen
  const max = Math.pow(10, len)
  return Math.floor(Math.random() * max)
}

const randEmail = () => `test_${randNum()}@email.com`
const randPass = () => randomString(12)

module.exports = { randNum, randEmail, randPass }
