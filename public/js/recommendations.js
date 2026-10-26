// Recommendations page: reads ?tone=N, asks the API for matches, and shows them as cards.
// Uses fetch().then().catch() only.

var params = new URLSearchParams(window.location.search)
var toneLevel = params.get('tone')
var category = 'foundation'

var resultsSection = document.querySelector('#results')
var statusBox = document.querySelector('#status')
var statusTitle = document.querySelector('#status-title')
var statusText = document.querySelector('#status-text')
var cardList = document.querySelector('#card-list')
var cardTemplate = document.querySelector('#card-template')
var coverage = document.querySelector('#coverage')
var brandCount = document.querySelector('#brand-count')
var goalText = document.querySelector('#goal-text')
var unreviewedBox = document.querySelector('#include-unreviewed')

// show a message in the status box (loading, empty, error, setup needed)
function showStatus (title, text) {
  statusTitle.textContent = title
  statusText.textContent = text
  statusBox.hidden = false
  cardList.replaceChildren()
  coverage.hidden = true
  resultsSection.setAttribute('aria-busy', 'false')
}

// make one card from the template. textContent is used so nothing from the data can act like HTML.
function makeCard (item, verified) {
  var card = cardTemplate.content.firstElementChild.cloneNode(true)
  card.querySelector('.card-brand').textContent = item.brand
  card.querySelector('.card-product').textContent = item.productName
  card.querySelector('.card-shade').textContent = item.shadeName

  var wording = [item.brandDepthLabel, item.brandUndertone].filter(Boolean).join(' / ')
  card.querySelector('.card-wording').textContent = wording ? 'Brand wording: ' + wording : ''

  var match = item.toneMatch
  card.querySelector('.card-match').textContent = match ? 'Our match: ' + match.confidence + ' confidence' : ''

  var swatch = card.querySelector('.card-swatch')
  var swatchLabel = card.querySelector('.card-swatch-label')
  if (item.shadeColor) {
    swatch.style.setProperty('--shade', item.shadeColor)
    swatchLabel.textContent = item.shadeColor
  } else {
    swatchLabel.textContent = 'Color not sourced'
  }

  var badge = card.querySelector('.card-status')
  badge.textContent = verified ? 'Reviewed' : 'Unreviewed proposal'
  if (!verified) badge.classList.add('badge-unverified')

  var links = card.querySelector('.card-links')
  addLink(links, item.productUrl, 'Product')
  addLink(links, item.sourceUrl, 'Source')
  return card
}

function addLink (box, url, text) {
  if (!url) return
  var a = document.createElement('a')
  a.href = url
  a.textContent = text
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  box.appendChild(a)
}

// ask the API for the matches
function loadRecommendations () {
  resultsSection.setAttribute('aria-busy', 'true')
  showStatus('Loading', 'Finding matches for your tone.')
  resultsSection.setAttribute('aria-busy', 'true')

  var url = '/api/recommendations?skinTone=' + encodeURIComponent(toneLevel) + '&category=' + category
  if (unreviewedBox.checked) url += '&status=needs-review'

  fetch(url)
    .then(function (response) {
      return response.json().then(function (body) {
        return { ok: response.ok, status: response.status, body: body }
      })
    })
    .then(function (answer) {
      if (answer.status === 503) {
        return showStatus('Setup needed', answer.body.message)
      }
      if (!answer.ok) {
        return showStatus('We could not load matches', answer.body.message || 'Please try again.')
      }
      var data = answer.body
      if (data.count === 0) {
        return showStatus('No matches yet', data.message)
      }
      statusBox.hidden = true
      cardList.replaceChildren()
      data.results.forEach(function (item) {
        cardList.appendChild(makeCard(item, data.verified))
      })
      brandCount.textContent = data.brandCount
      goalText.textContent = 'Goal: ' + data.brandGoal.min + ' to ' + data.brandGoal.max + ' brands per tone' + (data.brandGoal.met ? '' : ' (not reached yet)')
      coverage.hidden = false
      resultsSection.setAttribute('aria-busy', 'false')
    })
    .catch(function () {
      showStatus('We could not reach the server', 'Check that the server is running, then refresh the page.')
    })
}

// show the chosen tone, then load matches
function start () {
  if (!/^([1-9]|10)$/.test(String(toneLevel))) {
    return showStatus('Choose a tone first', 'Go back and pick one of the ten swatches to see your looks.')
  }
  fetch('/api/skin-tones')
    .then(function (response) { return response.json() })
    .then(function (data) {
      var tone = data.skinTones[Number(toneLevel) - 1]
      document.querySelector('#chosen-chip').style.setProperty('--tone', tone.hex)
      document.querySelector('#chosen-chip').setAttribute('aria-label', 'Color of ' + tone.name)
      document.querySelector('#chosen-name').textContent = tone.name
      document.querySelector('#chosen-hex').textContent = tone.hex
      loadRecommendations()
    })
    .catch(function () {
      showStatus('We could not reach the server', 'Check that the server is running, then refresh the page.')
    })
}

unreviewedBox.addEventListener('change', function () {
  if (/^([1-9]|10)$/.test(String(toneLevel))) loadRecommendations()
})

start()
