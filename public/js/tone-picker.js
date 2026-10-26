// Choose-your-tone page: shows which tone is selected and lets you clear it.
// The page works without this file too: the form still goes to recommendations.html?tone=N.

var form = document.querySelector('#tone-form')
var selectionText = document.querySelector('#selection-text')
var clearButton = document.querySelector('#clear-button')
var radios = document.querySelectorAll('input[name="tone"]')

// say which tone is picked (in words, not just color)
function showSelection () {
  var picked = document.querySelector('input[name="tone"]:checked')
  if (picked) {
    var tile = picked.parentNode.querySelector('.tone-name')
    selectionText.textContent = 'Selected: ' + tile.textContent
    clearButton.hidden = false
  } else {
    selectionText.textContent = 'No tone selected yet'
    clearButton.hidden = true
  }
}

radios.forEach(function (radio) {
  radio.addEventListener('change', showSelection)
})

clearButton.addEventListener('click', function () {
  form.reset()
  showSelection()
})

// if you come back with ?tone=6 in the address, pre-select it
var params = new URLSearchParams(window.location.search)
var wanted = params.get('tone')
if (wanted) {
  var match = document.querySelector('input[name="tone"][value="' + wanted + '"]')
  if (match) match.checked = true
}
showSelection()
