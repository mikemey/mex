const { randomString } = require('./rand')

const MESSAGE_ID_LENGTH = 6
const OK_STATUS = 'ok'
const NOK_STATUS = 'nok'
const ERROR_STATUS = 'error'

const randomMessageId = () => `<${randomString(MESSAGE_ID_LENGTH).toUpperCase()}>`

const createMessage = data => [randomMessageId(), createMessageBody(data)]
const parseMessage = raw => [raw[0].toString(), parseMessageBody(raw[1])]

const createMessageBody = body => JSON.stringify(body)
const parseMessageBody = body => JSON.parse(body)

const error = message => {
  return { status: ERROR_STATUS, message }
}

const withAction = action => {
  const actionBase = { action }
  const okBase = Object.assign({ status: OK_STATUS }, actionBase)
  const nokBase = Object.assign({ status: NOK_STATUS }, actionBase)
  const ok = (obj = {}) => Object.assign(obj, okBase)
  const nok = message => message ? Object.assign({ message }, nokBase) : nokBase
  const build = (obj = {}) => Object.assign(obj, actionBase)

  return { ok, nok, build }
}

module.exports = {
  randomMessageId,
  createMessage,
  parseMessage,
  createMessageBody,
  parseMessageBody,
  withAction,
  error,
  OK_STATUS,
  NOK_STATUS,
  ERROR_STATUS
}
