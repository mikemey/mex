class ATestPage {
  constructor (visitPath, titleSuffix) {
    this.path = visitPath
    this.title = `mex ${titleSuffix}`
  }

  visit () {
    return cy.visit(this.path)
  }

  assertPageActive () {
    return cy.title().should('equal', this.title)
  }
}

module.exports = ATestPage
