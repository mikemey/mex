const ok = action => {
  return { status: 'ok', action }
}

const nok = message => {
  return { status: 'nok', message }
}

const error = message => {
  return { status: 'error', message }
}

module.exports = { ok, nok, error }
