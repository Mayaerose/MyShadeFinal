# Full-Look Makeup Matcher 💄

A makeup recommendation app for people of color, with particular care for deeper complexions. You choose one of 10 skin tone swatches and get makeup matched to that tone, with the source and review status of every match.

## Status: Demo Day checkpoint (Monday, October 26, 2026)

Done for this checkpoint:

- [x] Wireframe: [docs/wireframe.html](docs/wireframe.html)
- [x] Visual design direction and style guide: [docs/style-guide.html](docs/style-guide.html)
- [x] HTML structure: `public/index.html` and `public/recommendations.html`
- [x] Page layout (CSS) for phone and desktop: `public/css/style.css`
- [x] API with full CRUD: `app/routes/api.js`, notes in [docs/api.md](docs/api.md)

Not started yet (on purpose): accounts, saved looks, selfie estimation, and the other makeup categories. Foundation comes first.

## Screenshot

![The Choose your tone page with Shade 02 selected](screenshots/choose-your-tone.jpg)

## Tech Used

- HTML, CSS, vanilla JavaScript (`fetch().then().catch()`)
- Node.js and Express
- MongoDB with Mongoose
- dotenv, csv-parse

## How to Use

1. Install the packages:
   ```
   npm install
   ```
2. Make your own `.env` file by copying `.env.example`, then fill in your own values. Never put these on GitHub:
   ```
   MONGODB_URI=your MongoDB connection string
   ADMIN_API_KEY=any long secret phrase
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open `http://localhost:4000`. The server also starts without a database, so the pages work and the recommendations say "setup needed".
5. To load the proposed foundation matches (all saved as **needs-review**):
   ```
   npm run seed:dry
   npm run seed
   ```
6. Check the API in your browser or Thunder Client:
   - `http://localhost:4000/api/health`
   - `http://localhost:4000/api/skin-tones`
   - `http://localhost:4000/api/recommendations?skinTone=6&category=foundation`

Nothing counts as verified until you approve it: `PATCH /api/products/:id` with `{ "reviewStatus": "approved" }`. On the Your looks page, the checkbox "Include unreviewed proposals" shows the not-yet-verified ones, clearly labeled.

## Project Layout

```
server.js               Express server
app/routes/api.js       all API routes
app/models/             the ProductShade Mongoose model
config/                 the 10 swatches and the category list
public/                 the pages, CSS and browser JavaScript
docs/                   wireframe, style guide, API notes
scripts/seed.js         loads the proposed matches
data/                   the proposed matches (CSV) to review
```

## Author

Maya Rose 🌹
