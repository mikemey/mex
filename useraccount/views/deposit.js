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

const setInvoiceEntry = invoice => {
  const row = $(`tr[data-invoice="${invoice.id}"`)[0]
  if (row) { row.remove() }

  const templateRow = $('tr[data-invoice="template-row"')[0]
  const $clone = $(templateRow).clone()
  $clone.removeClass('d-none')
  setInvoiceIn($clone, invoice)
  $('#invoices tr:first').before($clone)
}

const setInvoiceIn = (row, { id, href, hrdate, hramount, block }) => {
  row.attr('data-invoice', id)
  row.find('td:nth-child(1)').text(hrdate)
  row.find('td:nth-child(2)').text(hramount)
  if (block.href) {
    row.find('td:nth-child(3) span').remove()
    const blockAnchor = row.find('td:nth-child(3) a')
    blockAnchor.removeClass('d-none')
    blockAnchor.text(block.id)
    blockAnchor.attr('href', block.href)
  } else {
    row.find('td:nth-child(3) span').text(block.id)
  }
  const txAnchor = row.find('td:nth-child(4) a')
  txAnchor.text(id)
  txAnchor.attr('href', href)
}
