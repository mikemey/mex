class LogTrait {
  constructor (category) {
    this.category = category || this.constructor.name
    this.debug = false
  }

  log (msg, obj) {
    if (this.debug) {
      console.log(`[${this.category}] ${msg}`)
      if (obj) { console.log(obj) }
    }
  }
}

module.exports = LogTrait
