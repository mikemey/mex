const passportLocalMongoose = require('passport-local-mongoose')

const mg = require('../utils').dbconnection.mongoose

const AccountSchema = new mg.Schema({
  email: { type: String, index: true },
  password: String
})
AccountSchema.plugin(passportLocalMongoose, {
  usernameField: 'email',
  usernameLowerCase: true,
  usernameUnique: true
})

const Account = mg.model('Account', AccountSchema)
module.exports = { Account }
