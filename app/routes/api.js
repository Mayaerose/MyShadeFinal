const express = require('express')
const mongoose = require('mongoose')
const ProductShade = require('../models/productShade')
const skinTones = require('../../config/skinTones')
const categories = require('../../config/categories')

const router = express.Router()

const BRAND_GOAL = { min: 8, max: 10 } // the catalog goal: 8 to 10 brands for every skin tone level

// ---------- helpers ----------

// true once Mongoose has finished connecting to MongoDB
function databaseReady () {
  return mongoose.connection.readyState === 1
}

// the answer we send when there is no database yet (instead of making up products)
function setupNeeded (res) {
  return res.status(503).json({
    error: 'setup-needed',
    message: 'The database is not connected yet. Add MONGODB_URI to your .env file and restart the server.'
  })
}

// "4" -> 4. Anything that is not a whole number from 1 to 10 -> null
function parseLevel (value) {
  if (!/^([1-9]|10)$/.test(String(value))) return null
  return Number(value)
}

// turn a database or validation error into a clear JSON answer
function sendError (res, err) {
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'validation-failed',
      message: Object.values(err.errors).map(e => e.message).join(' '),
      fields: Object.keys(err.errors)
    })
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'duplicate', message: 'That brand + product + shade is already saved.' })
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'bad-value', message: 'One of the values has the wrong type: ' + err.path + '.' })
  }
  console.log(err)
  return res.status(500).json({ error: 'server-error', message: 'Something went wrong on the server.' })
}

// the only fields a request is allowed to set (so nobody can sneak in _id or timestamps)
const FIELDS = ['brandName', 'productName', 'category', 'shadeName', 'shadeColor', 'brandDepthLabel',
  'brandUndertone', 'toneMatches', 'productUrl', 'sourceUrl', 'sourceCoverage', 'reviewStatus', 'checkedAt']

function pickFields (body) {
  const picked = {}
  FIELDS.forEach(name => { if (body && body[name] !== undefined) picked[name] = body[name] })
  return picked
}

// what one product looks like in the API
function shape (doc) {
  return {
    id: doc._id,
    brand: doc.brandName,
    productName: doc.productName,
    category: doc.category,
    shadeName: doc.shadeName,
    shadeColor: doc.shadeColor || null, // null = no source gave us a color, so we don't show one
    brandDepthLabel: doc.brandDepthLabel || null,
    brandUndertone: doc.brandUndertone || null,
    toneMatches: doc.toneMatches,
    reviewStatus: doc.reviewStatus,
    productUrl: doc.productUrl || null,
    sourceUrl: doc.sourceUrl || null,
    sourceCoverage: doc.sourceCoverage || null,
    checkedAt: doc.checkedAt || null
  }
}

// ---------- READ: health, skin tones, recommendations ----------

router.get('/health', (req, res) => {
  res.json({ status: 'ok', database: databaseReady() ? 'connected' : 'not connected' })
})

router.get('/skin-tones', (req, res) => {
  res.json({ count: skinTones.length, skinTones })
})

router.get('/categories', (req, res) => {
  res.json({ categories })
})

// GET /api/recommendations?skinTone=6&category=foundation
// Only "approved" products are returned unless you ask for status=needs-review (clearly marked unverified).
router.get('/recommendations', (req, res) => {
  const level = parseLevel(req.query.skinTone)
  if (!level) {
    return res.status(400).json({ error: 'bad-skin-tone', message: 'skinTone must be a whole number from 1 to 10.' })
  }
  const category = req.query.category || 'foundation'
  if (!categories.some(c => c.id === category)) {
    return res.status(400).json({ error: 'bad-category', message: 'category must be one of: ' + categories.map(c => c.id).join(', ') + '.' })
  }
  const status = req.query.status || 'approved'
  if (!['approved', 'needs-review'].includes(status)) {
    return res.status(400).json({ error: 'bad-status', message: 'status must be approved or needs-review.' })
  }
  if (!databaseReady()) return setupNeeded(res)

  const tone = skinTones[level - 1]
  ProductShade.find({ category, reviewStatus: status, 'toneMatches.level': level })
    .sort({ brandName: 1, shadeName: 1 })
    .then(docs => {
      const results = docs.map(doc => ({ ...shape(doc), toneMatch: doc.toneMatches.find(m => m.level === level) }))
      const brandCount = new Set(results.map(r => r.brand)).size
      const response = {
        skinTone: { level: tone.level, name: tone.name, hex: tone.hex },
        category,
        reviewStatus: status,
        verified: status === 'approved', // false = proposals nobody has checked yet
        count: results.length,
        brandCount,
        brandGoal: { ...BRAND_GOAL, met: brandCount >= BRAND_GOAL.min },
        results
      }
      if (results.length === 0) {
        response.message = 'No ' + (status === 'approved' ? 'reviewed ' : '') + category + ' matches for ' + tone.name + ' yet. This is a gap in the catalog, not a mistake.'
      }
      res.json(response)
    })
    .catch(err => sendError(res, err))
})

// ---------- CRUD for the product catalog: /api/products ----------

// writes (create, update, delete) need the secret key from .env, so strangers can't edit the catalog
function requireWriteAccess (req, res, next) {
  const key = process.env.ADMIN_API_KEY
  if (key) {
    if (req.get('x-api-key') === key) return next()
    return res.status(401).json({ error: 'unauthorized', message: 'Send the x-api-key header to change the catalog.' })
  }
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'writes-disabled', message: 'Set ADMIN_API_KEY to allow changes on a live server.' })
  }
  next() // local development with no key set: allowed
}

function requireDatabase (req, res, next) {
  if (!databaseReady()) return setupNeeded(res)
  next()
}

function requireValidId (req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'bad-id', message: 'That is not a valid product id.' })
  }
  next()
}

// READ ALL (with filters): /api/products?category=foundation&status=approved&skinTone=6&brand=Glossier&page=1&limit=50
router.get('/products', requireDatabase, (req, res) => {
  const filter = {}
  if (req.query.category) {
    if (!categories.some(c => c.id === req.query.category)) return res.status(400).json({ error: 'bad-category', message: 'Unknown category.' })
    filter.category = req.query.category
  }
  if (req.query.status) {
    if (!['needs-review', 'approved', 'inactive'].includes(req.query.status)) return res.status(400).json({ error: 'bad-status', message: 'Unknown status.' })
    filter.reviewStatus = req.query.status
  }
  if (req.query.skinTone) {
    const level = parseLevel(req.query.skinTone)
    if (!level) return res.status(400).json({ error: 'bad-skin-tone', message: 'skinTone must be a whole number from 1 to 10.' })
    filter['toneMatches.level'] = level
  }
  if (req.query.brand) filter.brandName = String(req.query.brand)

  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50))
  const page = Math.max(1, parseInt(req.query.page) || 1)
  Promise.all([
    ProductShade.find(filter).sort({ brandName: 1, shadeName: 1 }).skip((page - 1) * limit).limit(limit),
    ProductShade.countDocuments(filter)
  ])
    .then(([docs, total]) => res.json({ total, page, limit, products: docs.map(shape) }))
    .catch(err => sendError(res, err))
})

// READ ONE
router.get('/products/:id', requireDatabase, requireValidId, (req, res) => {
  ProductShade.findById(req.params.id)
    .then(doc => {
      if (!doc) return res.status(404).json({ error: 'not-found', message: 'No product with that id.' })
      res.json(shape(doc))
    })
    .catch(err => sendError(res, err))
})

// CREATE
router.post('/products', requireWriteAccess, requireDatabase, (req, res) => {
  ProductShade.create(pickFields(req.body))
    .then(doc => res.status(201).json(shape(doc)))
    .catch(err => sendError(res, err))
})

// UPDATE (only the fields you send are changed)
router.patch('/products/:id', requireWriteAccess, requireDatabase, requireValidId, (req, res) => {
  ProductShade.findById(req.params.id)
    .then(doc => {
      if (!doc) return res.status(404).json({ error: 'not-found', message: 'No product with that id.' })
      doc.set(pickFields(req.body))
      return doc.save().then(saved => res.json(shape(saved)))
    })
    .catch(err => sendError(res, err))
})

// DELETE
router.delete('/products/:id', requireWriteAccess, requireDatabase, requireValidId, (req, res) => {
  ProductShade.findByIdAndDelete(req.params.id)
    .then(doc => {
      if (!doc) return res.status(404).json({ error: 'not-found', message: 'No product with that id.' })
      res.json({ message: 'Product deleted.', deleted: shape(doc) })
    })
    .catch(err => sendError(res, err))
})

// any /api route that does not exist
router.use((req, res) => {
  res.status(404).json({ error: 'not-found', message: 'There is no API route at ' + req.originalUrl + '.' })
})

module.exports = router
