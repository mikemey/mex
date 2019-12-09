const { randomString } = require('./rand')

const MESSAGE_ID_LENGTH = 6
const OK_STATUS = 'ok'
const NOK_STATUS = 'nok'
const ERROR_STATUS = 'error'

const BROADCAST_TYPE = 'b'
const ID_MSG_TYPE = 'm'
const ID_MSG_BODY_IX = MESSAGE_ID_LENGTH + 1

const randomMessageId = () => randomString(MESSAGE_ID_LENGTH).toUpperCase()

const createRawMessage = (messageId, messageBody) => {
  if (messageId && messageId.constructor === String && messageId.length === MESSAGE_ID_LENGTH &&
    messageBody && messageBody.constructor === Object) {
    const rawBody = JSON.stringify(messageBody)
    return `${ID_MSG_TYPE}${messageId}${rawBody}`
  } else {
    throw new Error(`message.id (string, len: ${MESSAGE_ID_LENGTH}) and message.body (object) required`)
  }
}

const createBroadcastMessage = (topic, messageBody) => {
  if (messageBody && messageBody.constructor === Object) {
    const rawBody = JSON.stringify(messageBody)
    return `${BROADCAST_TYPE}${topic}${rawBody}`
  } else {
    throw new Error('message.body (object) required')
  }
}

const extractMessage = rawMessage => {
  const isBroadcast = rawMessage.slice(0, 1) === BROADCAST_TYPE
  if (isBroadcast) {
    const bodyIx = rawMessage.indexOf('{')
    return {
      isBroadcast,
      topic: rawMessage.slice(1, bodyIx),
      body: JSON.parse(rawMessage.slice(bodyIx)),
      raw: rawMessage
    }
  }
  return {
    isBroadcast,
    id: rawMessage.slice(1, ID_MSG_BODY_IX),
    body: JSON.parse(rawMessage.slice(ID_MSG_BODY_IX)),
    raw: rawMessage
  }
}

const error = message => {
  return { status: ERROR_STATUS, message }
}

const withAction = action => {
  const actionBase = { action }
  const okBase = Object.assign({ status: OK_STATUS }, actionBase)
  const nokBase = Object.assign({ status: NOK_STATUS }, actionBase)
  const ok = (obj = {}) => Object.assign(obj, okBase)
  const nok = message => message ? Object.assign({ message }, nokBase) : nokBase
  const build = obj => Object.assign(obj, actionBase)

  return { ok, nok, build }
}

module.exports = {
  randomMessageId,
  createRawMessage,
  createBroadcastMessage,
  extractMessage,
  withAction,
  error,
  OK_STATUS,
  NOK_STATUS,
  ERROR_STATUS
}
