const nok = message => {
  return { status: 'nok', message }
}

const error = message => {
  return { status: 'error', message }
}

module.exports = { nok, error }
