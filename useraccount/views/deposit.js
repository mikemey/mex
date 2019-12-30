/* global $ WebSocket */

$(document).ready(() => {
  const location = $(window.location)[0]
  const host = location.host
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = document.getElementById('wspath').value
  const wsurl = `${protocol}//${host}${path}`

  const ws = new WebSocket(wsurl)
  ws.onmessage = msg => {
    const invoice = JSON.parse(msg.data)
    setInvoiceEntry(invoice)
  }
})

const setInvoiceEntry = ({ id, href, hrdate, hramount, block }) => {
  const row = $(`tr[data-invoice="${id}"`)[0]
  if (row) {
    $(row).replaceWith(`<tr data-invoice="${id}">` +
      `<td>${hrdate}</td><td>${hramount}</td>` +
      `<td><a href="${block.href}" target="_blank">${block.id}</a></td>` +
      `<td><a href="${href}" target="_blank">${id}</a></td></tr>`)
  } else {
    $('#invoices tr:first').before(`<tr data-invoice="${id}">` +
      `<td>${hrdate}</td><td>${hramount}</td>` +
      `<td>${block.id}</td>` +
      `<td><a href="${href}" target="_blank">${id}</a></td></tr>`)
  }
}
