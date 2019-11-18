class LogTrait {
  constructor (category) {
    this.category = category || this.constructor.name
  }

  log (msg) { console.log(`[${this.category}] ${msg}`) }
}

module.exports = LogTrait
