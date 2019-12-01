const TestData = require('../test-tools/test-data-setup')

module.exports = (on, config) => {
  on('task', {
    dropTestDatabase () { return TestData.dropTestDatabase() },
    seedTestData () { return TestData.seedTestData() },
    getRegisteredUser () { return TestData.registeredUser }
  })
}
