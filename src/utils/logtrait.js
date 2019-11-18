class LogTrait {
  constructor (category) {
    this.category = category || this.constructor.name
  }

  log (msg, obj) {
    console.log(`[${this.category}] ${msg}`)
    if (obj) console.log(obj)
  }
}

module.exports = LogTrait
