# 10X Hustle Leaderboard

Static leaderboard site for Trainers and FMs across:

- `1P Elite`
- `2P Elite`
- `Gold's 1P`

The site reads the public Google Sheet directly and shows:

- all trainers and FMs in each ownership
- city and designation filters
- name/center search
- contest revenue
- payout
- overall achievement
- remarks for payout or no-payout status

## Files to upload

- `index.html`
- `styles.css`
- `app.js`
- `README.md`

## Deploy with GitHub Pages

1. Create a new public GitHub repository.
2. Click `Add file` -> `Upload files`.
3. Upload `index.html`, `styles.css`, `app.js`, and `README.md`.
4. Commit the files to the `main` branch.
5. Open `Settings` in the repo.
6. Open `Pages`.
7. Under `Build and deployment`, choose:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
8. Click `Save`.
9. Wait 1 to 5 minutes.
10. Your public site link will appear in the `Pages` section.

## Update later

Whenever you want to change the site:

1. Open the repo on GitHub.
2. Replace or edit the file.
3. Commit the change.
4. GitHub Pages will redeploy automatically.

## Notes

- Your Google Sheet must stay publicly accessible for the site to load data.
- Payout values are shown exactly from the sheet.
- Remarks are generated in the site based on sheet values.
