# Unit Entry Performance Dashboard

Dashboard monitoring Unit Entry AHASS Astra Motor Sumatera Selatan.

## Files
- `index.html` — dashboard structure
- `style.css` — responsive corporate styling
- `script.js` — Google Sheets CSV connection, calculations, filters and charts

## Data source
Google Sheets published CSV URL is configured in `script.js` (`CSV_URL`).

The parser expects the published sheet to follow the supplied workbook structure:
1. No
2. Grup Dealer
3. Kabupaten
4. Status
5. NO. AHASS
6. NAMA AHASS
7. Month to Date Last Month
8. Target November
9. Actual November
10. Growth vs M-1
11. Acv M

A leading blank column is supported, as in the provided workbook. The dashboard calculates overall achievement as total Actual / total Target and overall MTD growth as total Actual / total MTD Last Month - 1.

## Deploy to GitHub Pages
1. Create a new GitHub repository, e.g. `unit-entry-performance-sumsel`.
2. Upload the three website files (`index.html`, `style.css`, `script.js`) to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then Save.
6. Open the published GitHub Pages URL after deployment completes.

## Notes
- Google Sheets must remain published to the web as CSV and accessible to dashboard visitors.
- The dashboard refreshes automatically every 5 minutes and also has a manual refresh button.
- If the Google Sheet column order changes, update the field mapping in `parseRows()` in `script.js`.
- Charts use Chart.js and CSV parsing uses Papa Parse via CDN.

## Calculation and formatting
- Growth vs M-1 is read as a decimal ratio and displayed as a percentage: `(Actual November / MTD Last Month) - 1`.
- Achievement is read as a decimal ratio and displayed as a percentage: `Actual November / Target November`.
- Count columns use Indonesian thousands separators (for example, `2.413` means 2,413).
- The ratio parser is separate from the count parser to avoid treating decimal fractions such as `0.4775` as `4,775`.
