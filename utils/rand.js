const randomLarge = () => Math.floor(Math.random() * 1000000000000) + 1000000000000
const randomHash = () => randomLarge().toString(36).substring(1)

const randomString = (len = 10) => {
  let res = ''
  while (res.length < len) {
    res += Math.random().toString(36).substring(2, 15)
  }
  return res.substring(0, len)
}

module.exports = { randomHash, randomString }
