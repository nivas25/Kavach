# Kavach - Agentic Contract Review System

Kavach is an advanced, AI-powered contract review system that employs a multi-agent debate architecture to analyze legal documents. It automatically extracts clauses, assesses risks, and hosts a live debate between a User Advocate, an India Legal Expert, and a Company Defender, culminating in a balanced verdict from a Neutral Judge.

## Architecture

The system is split into two parts:
1. **Frontend:** A Next.js application providing a modern, rich UI with real-time SSE streaming for the debate room.
2. **Backend:** A Fastify & Mastra-powered Node.js server orchestrating complex multi-agent workflows, utilizing Qdrant (Vector DB), Upstash Redis (Caching), and Supabase.

---

## Local Development

### 1. Backend Setup
Navigate to the `backend` directory:
```bash
cd backend
npm install
```

Create a `.env` file using the provided template:
```bash
cp .env.example .env
```
Fill in the necessary API keys (OpenAI, Featherless, Qdrant, Upstash Redis, etc.).

Run the backend in development mode:
```bash
npm run dev
```
The backend will run on `http://localhost:8080`.

### 2. Frontend Setup
Navigate to the `frontend` directory:
```bash
cd frontend
npm install
```

Create a `.env.local` file using the template:
```bash
cp .env.example .env.local
```
Ensure `NEXT_PUBLIC_API_URL` points to your local backend (`http://localhost:8080`).

Run the frontend in development mode:
```bash
npm run dev
```
The frontend will be available at `http://localhost:3000`.

---

## Production Deployment

### Deploying the Backend (Railway)
The backend is configured to be deployed easily on [Railway](https://railway.app/).
1. Create a new project in Railway and link this GitHub repository.
2. Set the **Root Directory** to `/backend`.
3. Railway will automatically use the provided `railway.json` and Nixpacks to build and start the server.
4. Copy the environment variables from `backend/.env.example` into your Railway project's **Variables** settings.

### Deploying the Frontend (Vercel)
The frontend is configured for a seamless deployment on [Vercel](https://vercel.com/).
1. Create a new project in Vercel and import this repository.
2. During the import step, set the **Root Directory** to `frontend`.
3. Vercel will automatically detect the Next.js framework.
4. In the Environment Variables section, set `NEXT_PUBLIC_API_URL` to your live Railway backend URL (e.g., `https://kavach-backend.up.railway.app`).
5. Click **Deploy**.

---

## Technical Stack
- **Frameworks:** Next.js (React), Fastify (Node.js)
- **AI / Agentic Framework:** Mastra, AI SDK
- **Models:** OpenAI (`gpt-4o-mini`), Featherless (`Qwen2.5-7B-Instruct`)
- **Infrastructure:** Qdrant (Vector Search), Upstash (Redis), Supabase (PostgreSQL)
- **Styling:** Tailwind CSS + Framer Motion
