
const categoryLog = category => msg => {
  console.log(`[${category}] ${msg}`)
}

class LogTrait {
  constructor (category) {
    this.categoryLog = categoryLog(category || this.constructor.name)
    this.debug = process.env.TESTING === undefined
  }

  log (msg, obj) {
    if (this.debug) {
      this.categoryLog(msg)
      if (obj) { console.log(obj) }
    }
  }

  errorLog (err) {
    if (typeof err === 'string' || err instanceof String) {
      this.categoryLog(err)
    } else {
      console.log(err)
    }
  }
}

module.exports = LogTrait
