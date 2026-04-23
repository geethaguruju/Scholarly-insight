# Scholarly Insight

Scholarly Insight is a full-stack web app for discovering and tracking arXiv papers across research domains. It includes a React frontend, a Node.js backend that converts arXiv's Atom/XML feed into clean JSON, and Firebase Auth + Firestore for user accounts and personalized data.

## What is included

- Search and browse arXiv papers by keyword, author, category, and date range
- Detailed article view with abstract, metadata, and paper links
- Real Firebase Authentication with email/password and Google sign-in
- Saved favorites, reading history, alert preferences, and generated notifications
- Per-article discussion threads for collaborative review

## Project structure

```text
client/   React + Vite frontend + Firebase Auth/Firestore
server/   Express API + arXiv integration
```

## Firebase setup

1. Create a Firebase project in the Firebase console.
2. Add a Web App to that project.
3. Enable Authentication providers:
   `Email/Password`
   `Google` if you want popup sign-in
4. Create a Firestore database in production or test mode.
5. Copy the Firebase web config values into `client/.env`.

Use this `client/.env` file:

```bash
VITE_API_BASE_URL=http://localhost:4000
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Recommended starter Firestore rules for development:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /articles/{articleId}/discussionPosts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
  }
}
```

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the API server:

   ```bash
   npm run dev:server
   ```

3. In another terminal, start the frontend:

   ```bash
   npm run dev:client
   ```

4. Open `http://localhost:5173`.

Create `server/.env` if you want a custom API port:

```bash
PORT=4000
```

## How to test

Run the automated checks:

```bash
npm test
npm run build
```

Manual test flow:

1. Start both apps with `npm run dev:server` and `npm run dev:client`.
2. Open `http://localhost:5173`.
3. Sign up with email/password or sign in with Google.
4. Search for papers by keyword, author, and category.
5. Save a favorite and mark a paper as read.
6. Add an alert, then use `Refresh` to generate in-app notifications.
7. Post a discussion comment on an article.
8. Refresh the page and confirm your data reloads from Firestore.

## Notes for your team

- The backend is now only responsible for arXiv integration.
- User state and collaboration data are stored in Firestore.
- Notifications are currently implemented as in-app notifications generated from the user's alert categories and the latest arXiv results.
