# Library Circulation Register

**Live app:** https://library-circulation-register.vercel.app/       "The loading will be slow at first request because of Inactivity.Please Wait"

## Problem (in two lines)

A public library tracks book issues and returns on paper cards, so nobody can tell at a glance which books are out, which are overdue, or which titles are actually in demand. This project replaces that with a digital register showing current loans, overdue days, and most-borrowed titles, plus a chat assistant to answer questions in plain language.

## How It's Built

- **Frontend:** React (`App.js`), deployed on Vercel. Reads circulation data from `book_issue_records.json` and renders the dashboard, table, search/filter, and record detail panel.
- **Backend (AI Assistant):** FastAPI (`main.py`), deployed on Render. Receives a question, turns it into a structured query plan using the Groq API (`llama-3.3-70b-versatile`), executes that plan against the same JSON dataset in Python, and asks the model to phrase the calculated result as a natural-language answer. The model never invents or recalculates numbers — it only rephrases what Python already computed.

## How to Run

### Option 1 — Use the deployed version
Just open https://library-circulation-register.vercel.app/. The dashboard and table work immediately. For the AI assistant (the floating chat button), the Render backend must be awake — if it's been idle it may take ~30–50 seconds to respond to the first question (free-tier cold start).

### Option 2 — Run locally

**Frontend**
```bash
git clone <your-repo-url>
cd <repo-folder>/frontend
npm install
npm start
```
This runs on `http://localhost:3000` and expects `book_issue_records.json` and `message.png` to be in the `public/` folder.

**Backend**
```bash
cd <repo-folder>/backend
pip install fastapi uvicorn groq python-dotenv
```
Create a `.env` file in the backend folder:
```
GROQ_API_KEY=your_groq_api_key_here
```
Make sure `book_issue_records.json` sits next to `main.py` (the backend reads it directly, not through the frontend). Then run:
```bash
uvicorn main:app --reload
```
This starts the API on `http://localhost:8000`. Note: the deployed frontend currently points `askAssistant()` at the Render URL, not localhost — for full local testing you'd change that fetch URL to `http://localhost:8000/ask`.

## What Every Field Means

| Field | Meaning | Values |
|---|---|---|
| `issue_id` | Unique ID for this borrowing event | e.g. `"ISS001"` |
| `book_id` | Unique ID for the physical/catalog book | e.g. `"BK014"` |
| `title` | Book title | free text; may be missing → shown as "Unknown title" |
| `member_name` | Name of the borrower | free text; may be missing → shown as "Unknown member"; some records intentionally have near-duplicate names to test fuzzy search |
| `issue_date` | Date the book was handed out | `YYYY-MM-DD`; shown as "Unknown" if missing |
| `due_date` | Date the book is expected back | `YYYY-MM-DD`; used to calculate overdue days |
| `return_date` | Date the book was actually returned | `YYYY-MM-DD`, or empty/null if still out |
| `status` | Current state of the record | `"issued"`, `"returned"`, or effectively `"overdue"` when a due date has passed with no return |

## How the Derived Figure (Days Overdue) Is Calculated

This is the number the librarian acts on, so both frontend and backend calculate it the same way, independently, from raw dates:

1. If `return_date` is already set → **0 days overdue** (it's back, overdue no longer applies).
2. If `return_date` is empty and `due_date` is missing → the figure is treated as **unknown**, never shown as 0 or as a fabricated number.
3. Otherwise:
   ```
   days_overdue = (today's date) − (due_date)
   ```
   measured in whole calendar days (time-of-day is zeroed out first so it's a clean day count).
4. If that difference is negative or zero (not yet due) → **0 days overdue**.
5. If positive → that count is shown as **"N DAYS OVERDUE"** in red on the record detail view, at the top, above the rest of the fields.

Dashboard cards use the same rule in aggregate:
- **Currently Borrowed** = records with no `return_date`
- **Overdue** = records where the above calculation returns more than 0
- **Returned** = records with a `return_date` set
- **Most Borrowed Titles** = count of how many times each `title` appears across all records, sorted highest first, top 5 shown

## Assistant — Supported Question Types

The assistant doesn't do free-form lookup; it maps your question into one of five operations, runs it in Python against the dataset, and phrases the result:
- **count** — "How many books are overdue?"
- **list** — "Which books does [member] have?"
- **most_borrowed** — "What are the most borrowed titles?"
- **search** — general lookups by title/member/book ID (with fuzzy/typo-tolerant matching)
- **summary** — "Give me an overview of the library right now"

Input is normalized (lowercased, trimmed, punctuation stripped) before matching, and fuzzy string matching handles minor misspellings in titles or names.

## What Is Not Finished

- The assistant currently only tests intent-matching for the operations above in English; it doesn't reliably fall back to "I don't know" wording for fully out-of-scope questions beyond returning whatever the model produces from an empty/irrelevant result.
- No authentication — anyone with the link can see all records; the "ask as two different members" isolation test isn't implemented (the assistant currently answers from the full dataset regardless of who's asking).
- Backend is on Render's free tier, so the first request after inactivity is slow (cold start).
