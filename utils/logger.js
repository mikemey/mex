const LEVELS = {
  none: { ord: -1, hrName: 'none' },
  error: { ord: 0, hrName: 'error' },
  info: { ord: 1, hrName: ' info' },
  debug: { ord: 2, hrName: 'debug' }
}

const defaultLevel = 'info'
const getLogLevel = () => {
  const envLevel = (process.env.LOG_LEVEL || defaultLevel).toLowerCase()
  const level = Object.values(LEVELS)
    .find(data => data.hrName.trim() === envLevel) || LEVELS.info
  return level.ord
}

const Logger = category => {
  const data = {
    currentLevel: getLogLevel()
  }

  const hrcategory = `[${category}]`
  const debug = (...args) => output(LEVELS.debug, hrcategory, ...args)
  const info = (...args) => output(LEVELS.info, hrcategory, ...args)
  const error = (...args) => output(LEVELS.error, hrcategory, ...args)

  const childLogger = subcategory => Logger(`${category} ${subcategory}`)

  const output = (level, category, ...args) => {
    if (level.ord > data.currentLevel) { return }

    const [texts, errs] = args
      .filter(el => el !== undefined && el !== null)
      .reduce(([texts, errors], current) => {
        return current instanceof Error
          ? [texts, [...errors, current]]
          : [[...texts, current], errors]
      }, [[new Date().toISOString(), level.hrName, category], []])
    console.log(...texts)
    errs.forEach(err => console.log(err))
  }

  return { debug, info, error, childLogger }
}

module.exports = Logger
