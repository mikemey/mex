const LEVELS = {
  error: { ord: 0, hrName: 'error' },
  info: { ord: 1, hrName: ' info' },
  debug: { ord: 2, hrName: 'debug' }
}

const output = (level, category, ...args) => {
  const [texts, errs] = args
    .filter(el => el !== undefined && el !== null)
    .reduce(([texts, errors], current) => {
      return current instanceof Error
        ? [texts, [...errors, current]]
        : [[...texts, current], errors]
    }, [[new Date().toISOString(), level, category], []])
  console.log(...texts)
  errs.forEach(err => console.log(err))
}

const Logger = category => {
  const hrcategory = `[${category}]`
  const debug = (...args) => output(LEVELS.debug.hrName, hrcategory, ...args)
  const info = (...args) => output(LEVELS.info.hrName, hrcategory, ...args)
  const error = (...args) => output(LEVELS.error.hrName, hrcategory, ...args)

  const childLogger = subcategory => Logger(`${category} ${subcategory}`)
  return { debug, info, error, childLogger }
}

module.exports = Logger
