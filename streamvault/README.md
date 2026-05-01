# StreamVault Frontend

A complete frontend for your Node.js/Express video backend.

## Files
- `index.html` — All markup & modals
- `style.css`  — All styles (dark theme, responsive)
- `app.js`     — All logic, API calls, state

## Setup
1. Start your backend: `npm run dev` (must run on port 8000)
2. Open `index.html` in a browser — or serve with:
   ```
   npx serve .
   ```
3. If your backend runs on a different port, change line 1 of `app.js`:
   ```js
   const API_BASE = 'http://localhost:8000/api/v1';
   ```

## Route Map (your app.js)
| Resource      | Prefix               |
|---------------|----------------------|
| Users         | `/api/v1/users`      |
| Videos        | `/api/v1/video`      |
| Tweets        | `/api/v1/tweet`      |
| Subscriptions | `/api/v1/subscriber` |
| Playlists     | `/api/v1/playlist`   |
| Likes         | `/api/v1/like`       |
| Comments      | `/api/v1/comment`    |
| Dashboard     | `/api/v1/dashboard`  |

## Features
- Register / Login / Logout
- Browse, search, upload, edit, delete videos
- Video player with comments (post, edit, delete, like)
- Subscribe / Unsubscribe to channels
- Like / Unlike videos, comments, tweets
- Playlists (create, delete, add videos)
- Community posts (create, edit, delete, like)
- Watch History (localStorage)
- Liked Videos page
- Channel dashboard with stats
- Profile page with avatar/cover edit
- Settings with preferences + password change
- Right-click context menu on video cards
- Keyboard shortcuts: / h d p t l H
- Upload progress bar
- Autoplay next video
- Fully responsive (mobile sidebar, breakpoints)
