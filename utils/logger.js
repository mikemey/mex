const LOG_LEVELS = {
  none: { ord: -1, hrName: 'none' },
  error: { ord: 0, hrName: 'error' },
  info: { ord: 1, hrName: ' info' },
  http: { ord: 2, hrName: ' http' },
  debug: { ord: 3, hrName: 'debug' }
}

const defaultLevel = 'info'
const getLogLevel = () => {
  const envLevel = (process.env.LOG_LEVEL || defaultLevel).toLowerCase()
  const levelKey = Object.keys(LOG_LEVELS).find(logLvlKey => logLvlKey === envLevel) || defaultLevel
  return LOG_LEVELS[levelKey].ord
}

const Logger = category => {
  const data = {
    currentLevel: getLogLevel()
  }

  const hrcategory = `[${category}]`
  const debug = (...args) => output(LOG_LEVELS.debug, ...args)
  const info = (...args) => output(LOG_LEVELS.info, ...args)
  const error = (...args) => output(LOG_LEVELS.error, ...args)

  const childLogger = subcategory => Logger(`${category} ${subcategory}`)

  const output = (level, ...args) => {
    if (skipLogLevel(level)) { return }

    const [texts, errs] = args
      .filter(el => el !== undefined && el !== null)
      .reduce(([texts, errors], current) => {
        if (current.constructor === Object) {
          current = JSON.stringify(current)
        }
        return current instanceof Error
          ? [texts, [...errors, current]]
          : [[...texts, current], errors]
      }, [[new Date().toISOString(), level.hrName, hrcategory], []])
    console.log(...texts)
    errs.forEach(err => console.log(err))
  }

  const skipLogLevel = level => level.ord > data.currentLevel

  const setLogLevel = logLevel => { data.currentLevel = logLevel.ord }

  return { debug, info, error, childLogger, skipLogLevel, setLogLevel }
}

module.exports = { Logger, LOG_LEVELS }
