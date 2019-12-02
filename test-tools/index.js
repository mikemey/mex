const crypto = require('crypto')

const trand = require('./trand')
const WSServerMock = require('./wsserver-mock')
const TestDataSetup = require('./test-data-setup')

const pwhasher = data => crypto.createHash('sha256').update(data).digest('hex')

module.exports = { pwhasher, trand, WSServerMock, TestDataSetup }
