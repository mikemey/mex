const TestData = require('../test-tools/test-data-setup')

module.exports = (on, config) => {
  on('task', {
    seedTestData () { return TestData.seedTestData() }
  })
}
