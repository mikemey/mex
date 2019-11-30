const TestData = require('../testtools/test-data-setup')

module.exports = (on, config) => {
  on('task', {
    seedTestData () { return TestData.seedTestData() }
  })
}
