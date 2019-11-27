const { randomString } = require('./rand')

const MESSAGE_ID_LENGTH = 6

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
  return { status: 'error', message }
}

const withAction = action => {
  const ok = () => { return { status: 'ok', action } }
  const nok = message => { return { status: 'nok', action, message } }

  return { ok, nok }
}

module.exports = { randomMessageId, createRawMessage, extractMessage, withAction, error }
