// Loads the PROPOSED foundation matches into MongoDB so the API has something to read.
//   npm run seed:dry   -> shows what would be saved (no database needed)
//   npm run seed       -> saves it
// Every record is saved as "needs-review". Nothing counts as verified until you approve it
// (PATCH /api/products/:id with { "reviewStatus": "approved" }). Safe to run twice.
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { parse } = require('csv-parse/sync')

const rows = parse(fs.readFileSync(path.join(__dirname, '../data/shade-matcher-10-tone-recommendations.csv')), { columns: true, bom: true, skip_empty_lines: true })
const blank = v => (v && v.trim() ? v.trim() : undefined)

const products = new Map()
rows.forEach(r => {
  const key = [r.brand_name, r.product_line, r.shade_name].join('|')
  if (!products.has(key)) {
    products.set(key, {
      brandName: r.brand_name.trim(),
      productName: r.product_line.trim(),
      category: 'foundation',
      shadeName: r.shade_name.trim(),
      brandDepthLabel: blank(r.brand_depth_label),
      brandUndertone: blank(r.brand_undertone),
      toneMatches: [],
      productUrl: blank(r.official_product_url),
      sourceUrl: blank(r.official_shade_source_url),
      sourceCoverage: blank(r.source_coverage),
      reviewStatus: 'needs-review', // always
      checkedAt: r.checked_date ? new Date(r.checked_date) : undefined
    })
  }
  products.get(key).toneMatches.push({ level: Number(r.app_tone_level_proposed), confidence: r.mapping_confidence.trim().toLowerCase(), basis: r.mapping_basis.trim() })
})

function report () {
  console.log(products.size + ' proposed foundation shades from ' + rows.length + ' rows')
  const perLevel = {}
  for (let level = 1; level <= 10; level++) {
    const brands = new Set()
    products.forEach(p => { if (p.toneMatches.some(m => m.level === level)) brands.add(p.brandName) })
    perLevel['Shade ' + String(level).padStart(2, '0')] = brands.size
  }
  console.log('Distinct brands per level (proposed, none verified yet). Goal is 8 to 10:')
  console.table(perLevel)
}

report()
if (process.argv.includes('--dry-run')) {
  console.log('Dry run only. Nothing was saved.')
} else {
  const mongoose = require('mongoose')
  const ProductShade = require('../app/models/productShade')
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => Promise.all([...products.values()].map(p =>
      ProductShade.updateOne({ brandName: p.brandName, productName: p.productName, shadeName: p.shadeName }, { $setOnInsert: p }, { upsert: true })
    )))
    .then(results => {
      const added = results.filter(r => r.upsertedCount).length
      console.log('Saved. ' + added + ' new records added as needs-review (' + (products.size - added) + ' already existed).')
      return mongoose.disconnect()
    })
    .catch(err => { console.log('Seed failed:', err.message); process.exit(1) })
}
