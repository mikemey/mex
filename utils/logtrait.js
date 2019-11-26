
const starttime = process.hrtime()
const categoryLog = category => (...args) => {
  const hrtime = process.hrtime(starttime)
  const hrms = Math.floor(hrtime[1] / 1000000)
  args.map(msg => msg.constructor === String ? msg : JSON.stringify(msg))
    .forEach(msg => console.log(` (${hrtime[0]}.${hrms}) [${category}] ${msg}`))
}

class LogTrait {
  constructor (category) {
    this.categoryLog = categoryLog(category || this.constructor.name)
    this.debug = process.env.TESTING !== undefined
  }

  log (...args) {
    if (this.debug) {
      this.categoryLog(...args)
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
