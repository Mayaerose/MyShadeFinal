# API notes: Full-Look Makeup Matcher

Start the server with `npm start`, then open `http://localhost:4000`. All answers are JSON.

## How the data flows

```
Browser page  --fetch-->  Express route (app/routes/api.js)  --Mongoose-->  MongoDB Atlas
(recommendations.js)      checks the request first            ProductShade model
        <--------------  JSON answer  <---------------------  (products, shades, tone matches)
```

1. The person picks a tone on `index.html`. The form opens `recommendations.html?tone=6`.
2. `recommendations.js` asks `GET /api/skin-tones` for the swatch, then `GET /api/recommendations?skinTone=6&category=foundation`.
3. Express checks the tone and category, asks MongoDB for approved products matched to that tone, and sends JSON back.
4. The page turns the JSON into cards. If there is nothing to show, the API says why instead of making something up.

## Rules the API follows

- Skin tone levels are always whole numbers from **1 to 10**.
- Categories are `foundation`, `concealer`, `blush`, `bronzer`, `lip`. Only foundation has data so far.
- Only products with `reviewStatus: "approved"` count as recommendations. Unreviewed proposals only show up if you ask for them with `status=needs-review`, and the answer says `"verified": false`.
- The API never makes up brands, shades or colors. `shadeColor` is `null` unless a source gave one.

## Read routes (no key needed)

| Route | What it does | Answers |
|---|---|---|
| `GET /api/health` | Checks the server is running | `200 { status: "ok", database: "connected" or "not connected" }` |
| `GET /api/skin-tones` | The ten swatches with their exact hex colors | `200 { count: 10, skinTones: [...] }` |
| `GET /api/categories` | The categories the API knows | `200 { categories: [...] }` |
| `GET /api/recommendations?skinTone=6&category=foundation` | Matches for one tone and category. Optional `status=needs-review` | `200` with results, or `200` with `count: 0` and a `message`, `400` for a bad tone, category or status, `503` if there is no database yet |

A recommendation answer includes `count`, `brandCount`, and `brandGoal` (8 to 10 brands per tone, with `met: true/false`) so gaps are visible.

## Catalog CRUD: `/api/products`

This is the full Create, Read, Update, Delete for the product catalog.

| Action | Route | Notes |
|---|---|---|
| Create | `POST /api/products` | JSON body. Answers `201` with the saved product. `409` if the same brand + product + shade exists. |
| Read all | `GET /api/products` | Filters: `category`, `status`, `skinTone`, `brand`, `page`, `limit` |
| Read one | `GET /api/products/:id` | `404` if there is no product with that id |
| Update | `PATCH /api/products/:id` | Send only the fields to change |
| Delete | `DELETE /api/products/:id` | Answers `200` with the deleted product |

Create, update and delete need the header `x-api-key: <your ADMIN_API_KEY>` when `ADMIN_API_KEY` is set in `.env`. With no key set they work on your own computer only, and they are blocked on a live server (`NODE_ENV=production`).

Example body to create a product:

```json
{
  "brandName": "Glossier",
  "productName": "Stretch Fluid Foundation",
  "category": "foundation",
  "shadeName": "Medium 3",
  "brandDepthLabel": "Medium",
  "toneMatches": [{ "level": 6, "confidence": "medium", "basis": "Brand depth label Medium" }],
  "productUrl": "https://www.glossier.com/products/stretch-fluid-foundation",
  "reviewStatus": "needs-review"
}
```

Approve it after you check the brand's page: `PATCH /api/products/:id` with `{ "reviewStatus": "approved" }`.

## Error answers

Every error looks like `{ "error": "short-code", "message": "A plain sentence." }`.

| Status | Meaning |
|---|---|
| 400 | The request was not valid (bad tone, category, id, JSON, or a field that failed a rule) |
| 401 / 403 | Missing or wrong `x-api-key`, or writes are turned off on a live server |
| 404 | No such route or product |
| 409 | Duplicate product |
| 503 | `setup-needed`: no database connected yet. Add `MONGODB_URI` to `.env` |

## Data model: ProductShade

`brandName`, `productName`, `category`, `shadeName`, `shadeColor` (only if sourced), `brandDepthLabel`, `brandUndertone`, `toneMatches` (a list of `{ level 1-10, confidence high/medium/low, basis }`), `productUrl`, `sourceUrl`, `sourceCoverage`, `reviewStatus` (`needs-review`, `approved`, `inactive`), `checkedAt`, plus automatic `createdAt` and `updatedAt`.
