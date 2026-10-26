const mongoose = require('mongoose')
const categories = require('../../config/categories')

const webLink = {
  type: String,
  trim: true,
  set: v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  // only web links, so a "javascript:" link can never reach the page
  validate: { validator: v => !v || /^https?:\/\//i.test(v), message: 'Links must start with http:// or https://' }
}

// our estimate of which swatch a shade belongs to, with how sure we are and why
const toneMatchSchema = new mongoose.Schema({
  level: {
    type: Number,
    required: [true, 'Each match needs a skin tone level.'],
    min: [1, 'Skin tone level must be from 1 to 10.'],
    max: [10, 'Skin tone level must be from 1 to 10.'],
    validate: { validator: Number.isInteger, message: 'Skin tone level must be a whole number.' }
  },
  confidence: { type: String, enum: { values: ['high', 'medium', 'low'], message: 'Confidence must be high, medium, or low.' }, required: [true, 'Each match needs a confidence.'] },
  basis: { type: String, required: [true, 'Each match needs a short basis (why this level).'], trim: true }
}, { _id: false })

// one document = one named shade of one product
const productShadeSchema = new mongoose.Schema({
  brandName: { type: String, required: [true, 'Brand name is required.'], trim: true },
  productName: { type: String, required: [true, 'Product name is required.'], trim: true },
  category: { type: String, required: [true, 'Category is required.'], enum: { values: categories.map(c => c.id), message: 'Category must be one of: ' + categories.map(c => c.id).join(', ') + '.' } },
  shadeName: { type: String, required: [true, 'Shade name is required.'], trim: true }, // exactly as the brand writes it
  shadeColor: { type: String, trim: true, set: v => (typeof v === 'string' && v.trim() === '' ? undefined : v), validate: { validator: v => !v || /^#[0-9a-f]{6}$/i.test(v), message: 'Shade color must look like #a07e56.' } }, // only when a source gives it
  brandDepthLabel: { type: String, trim: true },
  brandUndertone: { type: String, trim: true },
  toneMatches: { type: [toneMatchSchema], validate: { validator: v => v.length >= 1, message: 'Add at least one skin tone match.' } },
  productUrl: webLink,
  sourceUrl: webLink, // where the shade information was checked
  sourceCoverage: { type: String, trim: true },
  reviewStatus: { type: String, enum: ['needs-review', 'approved', 'inactive'], default: 'needs-review' },
  checkedAt: Date
}, { timestamps: true })

// the same brand + product + shade can only be saved once
productShadeSchema.index({ brandName: 1, productName: 1, shadeName: 1 }, { unique: true })
productShadeSchema.index({ category: 1, reviewStatus: 1, 'toneMatches.level': 1 })

module.exports = mongoose.model('ProductShade', productShadeSchema)
