# Fallen Americans - 2026

An interactive map honoring U.S. service members who have made the ultimate sacrifice in 2026.

Each marker represents an American hometown that lost someone.

## Purpose

To make visible the human cost of military operations to American citizens.

## Data

Data is sourced from public Department of Defense casualty announcements.

## Tech Stack

- **Leaflet.js** - Interactive mapping
- **CARTO Dark** - Map tiles
- Static HTML/CSS/JS - No backend required

## Local Development

Simply open `index.html` in a browser, or use a local server:

```bash
python -m http.server 8000
# or
npx serve
```

## Adding Data

Edit `data/soldiers.json` to add service members:

```json
{
  "id": 5,
  "name": "First Last",
  "rank": "Rank",
  "hometown": "City, State",
  "state": "XX",
  "lat": 00.0000,
  "lng": -00.0000,
  "date": "2026-MM-DD",
  "operation": "Operation Name",
  "branch": "Army/Navy/Marines/Air Force/Coast Guard",
  "photo": null
}
```

## Deployment

Static site - deploy anywhere:
- GitHub Pages
- Netlify
- Vercel
- Any static host

## License

Public domain. This is a memorial.
