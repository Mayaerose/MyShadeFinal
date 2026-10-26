// server.js: the Express server for the Full-Look Makeup Matcher
require('dotenv').config() // loads MONGODB_URI (and ADMIN_API_KEY) from the .env file
const express = require('express')
const mongoose = require('mongoose')
const app = express()
const PORT = process.env.PORT || 4000

app.use(express.json()) // lets routes read JSON sent in a request body
app.use(express.static('public')) // the pages: index.html, recommendations.html, css, js
app.use('/docs', express.static('docs')) // wireframe, style guide, API notes

app.use('/api', require('./app/routes/api'))

// bad JSON in a request body -> a clear JSON answer instead of an error page
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad-json', message: 'The request body is not valid JSON.' })
  }
  console.log(err)
  res.status(500).json({ error: 'server-error', message: 'Something went wrong on the server.' })
})

// the server starts even without a database, so the pages and /api/skin-tones still work
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.log('Could not connect to MongoDB:', err.message))
} else {
  console.log('No MONGODB_URI in .env yet. Recommendations will say "setup needed" until you add it.')
}

app.listen(PORT, () => console.log('Full-Look Makeup Matcher is running on http://localhost:' + PORT))
