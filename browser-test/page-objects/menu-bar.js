const menuButton = name => cy.get(`#header a:contains("${name}")`)

class MenuBar {
  assertItems (expectedItems) {
    cy.get('#header li').should(menuItems =>
      expectedItems.forEach((item, ix) => expect(menuItems[ix].innerText).to.equal(item))
    )
  }

  clickLogin () {
    menuButton('Login').click()
  }

  clickRegister () {
    menuButton('Register').click()
  }

  clickHome () {
    menuButton('Home').click()
  }
}

module.exports = MenuBar
