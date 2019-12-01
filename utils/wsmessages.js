const { randomString } = require('./rand')

const MESSAGE_ID_LENGTH = 6
const OK_STATUS = 'ok'
const NOK_STATUS = 'nok'
const ERROR_STATUS = 'error'

const randomMessageId = () => randomString(MESSAGE_ID_LENGTH).toUpperCase()

const createRawMessage = (messageId, messageBody) => {
  if (messageId && messageId.constructor === String && messageId.length === MESSAGE_ID_LENGTH &&
    messageBody && messageBody.constructor === Object) {
    const rawBody = JSON.stringify(messageBody)
    return `${messageId}${rawBody}`
  } else {
    throw new Error(`message.id (string, len: ${MESSAGE_ID_LENGTH}) and message.body (object) required`)
  }
}

const extractMessage = rawMessage => {
  return {
    id: rawMessage.slice(0, MESSAGE_ID_LENGTH),
    body: JSON.parse(rawMessage.slice(MESSAGE_ID_LENGTH)),
    raw: rawMessage
  }
}

const error = message => {
  return { status: ERROR_STATUS, message }
}

const withAction = action => {
  const ok = (obj = {}) => Object.assign(obj, { status: OK_STATUS, action })
  const nok = message => { return { status: NOK_STATUS, action, message } }
  const build = obj => Object.assign(obj, { action })

  return { ok, nok, build }
}

module.exports = { randomMessageId, createRawMessage, extractMessage, withAction, error, OK_STATUS, NOK_STATUS, ERROR_STATUS }
