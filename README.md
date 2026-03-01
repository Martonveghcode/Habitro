# Sintaxis WebApp (MVP)

React + TypeScript app for Spanish syntax practice with drag-and-drop annotation, Gemini generation/grading, and Firebase analytics.

## Stack

- Frontend: Vite + React + TypeScript + Zustand + dnd-kit
- Backend: Firebase Cloud Functions v2 (TypeScript)
- Data: Firestore (`/errors` + `/users/{uid}/analytics/summary`)
- LLM: Google Gemini through backend proxy

## Prerequisites

- Node.js 20+
- Firebase CLI (`npm i -g firebase-tools` or `npx firebase-tools`)
- Firebase project: `database-for-sintaxis`

## Local setup

1. Install web dependencies:
   ```bash
   npm install
   ```
2. Install Functions dependencies:
   ```bash
   npm --prefix functions install
   ```
3. Copy environment file:
   ```bash
   copy .env.example .env
   ```
4. Set Functions secret for Gemini:
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
5. Run frontend:
   ```bash
   npm run dev
   ```
6. Run emulators (from repo root):
   ```bash
   npx firebase-tools emulators:start --only firestore,functions
   ```

## Firestore paths

- Error documents: `/errors/{autoId}`
- Analytics summary: `/users/{uid}/analytics/summary`

## Functions

- `generateSentence` (HTTP POST)
- `gradeAttempt` (HTTP POST)
- `onErrorCreated` (Firestore trigger)

Both HTTP endpoints require a Firebase ID token in `Authorization: Bearer <token>`.

## Build checks

```bash
npm run build
npm --prefix functions run build
```
