
const sensibleLimit = 16
const randNum = (maxLen = 6) => {
  const len = maxLen > sensibleLimit ? sensibleLimit : maxLen
  const max = Math.pow(10, len)
  return Math.floor(Math.random() * max)
}

const randStr = (len = 10) => {
  let res = ''
  while (res.length < len) {
    res += Math.random().toString(36).substring(2, 15)
  }
  return res.substring(0, len)
}

const randEmail = () => `test_${randNum()}@email.com`
const randPass = () => randStr(12)

module.exports = { randNum, randStr, randEmail, randPass }
