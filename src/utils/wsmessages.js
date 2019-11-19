const error = message => {
  return { status: 'error', message }
}

const withAction = action => {
  const ok = () => { return { status: 'ok', action } }
  const nok = message => { return { status: 'nok', action, message } }

  return { ok, nok }
}

module.exports = { withAction, error }
