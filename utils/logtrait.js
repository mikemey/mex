
const starttime = process.hrtime()

const currentTimestamp = () => {
  const hrtime = process.hrtime(starttime)
  const hrms = Math.floor(hrtime[1] / 1000000)
  return `${hrtime[0]}.${hrms}`
}

const categoryLog = category => {
  const categoryOut = `[${category}]`
  return (...args) => {
    const [text, errs] = args
      .filter(el => el !== undefined && el !== null)
      .reduce(([ts, es], message) => {
        return message instanceof Error
          ? [ts, [...es, message]]
          : message.constructor === String
            ? [`${ts} ${message}`, es]
            : [`${ts} ${JSON.stringify(message)}`, es]
      }, [` (${currentTimestamp()}) ${categoryOut}`, []])

    console.log(text)
    errs.forEach(err => console.log(err))
  }
}

class LogTrait {
  constructor (category) {
    this.category = category || this.constructor.name
    this.categoryLog = categoryLog(this.category)
    this.debug = true
  }

  log (...args) {
    if (this.debug) {
      this.categoryLog(...args)
    }
  }

  createIdLog (id) {
    return categoryLog(`${this.category} #${id}`)
  }
}

module.exports = LogTrait
