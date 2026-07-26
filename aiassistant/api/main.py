from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from dotenv import load_dotenv
from datetime import date, datetime
from collections import Counter
from difflib import SequenceMatcher
import os
import json
import re

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is missing from .env")

client = Groq(
    api_key=GROQ_API_KEY
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","https://library-circulation-register.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

with open(
    BASE_DIR / "book_issue_records.json",
    "r",
    encoding="utf-8"
) as file:
    records = json.load(file)

def normalize_text(text):
    if text is None:
        return ""

    text = str(text).lower().strip()

    text = re.sub(
        r"[^\w\s]",
        "",
        text
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text

def similarity(
    text1,
    text2
):
    text1 = normalize_text(
        text1
    )

    text2 = normalize_text(
        text2
    )

    if not text1 or not text2:
        return 0

    if (
        text1 in text2
        or text2 in text1
    ):
        return 1

    direct_score = (
        SequenceMatcher(
            None,
            text1,
            text2
        ).ratio()
    )

    words1 = text1.split()
    words2 = text2.split()
    best_word_score = 0

    for word1 in words1:
        for word2 in words2:
            score = (
                SequenceMatcher(
                    None,
                    word1,
                    word2
                ).ratio()
            )

            best_word_score = max(
                best_word_score,
                score
            )

    return max(
        direct_score,
        best_word_score
    )

def parse_date(value):
    if not value:
        return None

    try:
        return datetime.fromisoformat(
            str(value)
        ).date()

    except ValueError:
        try:
            return date.fromisoformat(
                str(value)
            )

        except ValueError:
            return None

def get_days_overdue(
    record
):
    if record.get(
        "return_date"
    ):
        return 0

    due_date = parse_date(
        record.get(
            "due_date"
        )
    )

    if not due_date:
        return 0

    days = (
        date.today()
        - due_date
    ).days

    return max(
        days,
        0
    )

def create_query_plan(
    question
):
    prompt = f"""
You are a query planner for a library circulation system.

Convert the user's natural-language question into a JSON query plan.

Do not answer the question.

Return ONLY valid JSON.

Available fields:

- issue_id
- book_id
- title
- member_name
- issue_date
- due_date
- return_date
- status

Available operations:

- count
- list
- most_borrowed
- search
- summary

Available filter operators:

- equals
- contains
- is_null
- is_not_null
- returned
- currently_borrowed
- overdue
- overdue_days_greater_than

Rules:

1. Extract the important search term from the question.

2. For a book title, use:
   field = "title"

3. For a member, use:
   field = "member_name"

4. For a book ID, use:
   field = "book_id"

5. For questions asking how many records match a condition, use:
   operation = "count"

6. For questions asking which records match a condition, use:
   operation = "list"

7. For questions about the most borrowed books, use:
   operation = "most_borrowed"

8. For questions asking about overall library statistics, use:
   operation = "summary"

9. If a title or member name may contain a spelling mistake, still extract the intended search term.

10. Do not include information that is not present in the user's question.

Current date:

{date.today().isoformat()}

Return exactly this structure:

{{
    "operation": "count | list | most_borrowed | search | summary",
    "filters": [
        {{
            "field": "field_name",
            "operator": "equals | contains | is_null | is_not_null | returned | currently_borrowed | overdue | overdue_days_greater_than",
            "value": "value or null"
        }}
    ],
    "limit": 20
}}

User question:

{question}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0,
        response_format={
            "type": "json_object"
        }
    )

    content = (
        response
        .choices[0]
        .message
        .content
    )

    return json.loads(
        content
    )

def fuzzy_field_match(
    actual_value,
    search_value
):
    if not actual_value:
        return False

    actual_value = normalize_text(
        actual_value
    )

    search_value = normalize_text(
        search_value
    )

    if (
        search_value in actual_value
        or actual_value in search_value
    ):
        return True

    actual_words = (
        actual_value.split()
    )

    search_words = (
        search_value.split()
    )

    for search_word in search_words:
        best_score = 0

        for actual_word in actual_words:
            score = (
                SequenceMatcher(
                    None,
                    search_word,
                    actual_word
                ).ratio()
            )

            best_score = max(
                best_score,
                score
            )

        if best_score < 0.65:
            return False

    return True

def record_matches_filter(
    record,
    filter_data
):
    field = filter_data.get(
        "field"
    )

    operator = filter_data.get(
        "operator"
    )

    value = filter_data.get(
        "value"
    )

    if operator == "currently_borrowed":
        return not record.get(
            "return_date"
        )

    if operator == "returned":
        return bool(
            record.get(
                "return_date"
            )
        )

    if operator == "overdue":
        return (
            get_days_overdue(
                record
            ) > 0
        )

    if operator == "overdue_days_greater_than":
        try:
            required_days = int(
                value
            )

        except:
            return False

        return (
            get_days_overdue(
                record
            )
            > required_days
        )

    actual_value = record.get(
        field
    )

    if operator == "is_null":
        return (
            actual_value is None
            or actual_value == ""
        )

    if operator == "is_not_null":
        return (
            actual_value is not None
            and actual_value != ""
        )

    if operator == "equals":
        return fuzzy_field_match(
            actual_value,
            value
        )

    if operator == "contains":
        return fuzzy_field_match(
            actual_value,
            value
        )

    return False

def execute_query_plan(
    query_plan
):
    operation = query_plan.get(
        "operation"
    )

    filters = query_plan.get(
        "filters",
        []
    )

    limit = query_plan.get(
        "limit",
        20
    )

    matching_records = []

    for record in records:
        matches_all = True

        for filter_data in filters:
            if not record_matches_filter(
                record,
                filter_data
            ):
                matches_all = False
                break

        if matches_all:
            matching_records.append(
                record
            )

    if operation == "count":
        return {
            "operation":
            "count",

            "count":
            len(
                matching_records
            )
        }

    if operation == "list":
        result_records = []

        for record in (
            matching_records[:limit]
        ):
            result = dict(
                record
            )

            days_overdue = (
                get_days_overdue(
                    record
                )
            )

            if days_overdue > 0:
                result[
                    "days_overdue"
                ] = days_overdue

            result_records.append(
                result
            )

        return {
            "operation":
            "list",

            "total_matches":
            len(
                matching_records
            ),

            "records":
            result_records
        }

    if operation == "most_borrowed":
        title_counts = Counter()

        for record in records:
            title = record.get(
                "title"
            )

            if title:
                title_counts[
                    title
                ] += 1

        most_borrowed = []

        for title, count in (
            title_counts
            .most_common(limit)
        ):
            most_borrowed.append({
                "title":
                title,

                "borrow_count":
                count
            })

        return {
            "operation":
            "most_borrowed",

            "books":
            most_borrowed
        }

    if operation == "search":
        return {
            "operation":
            "search",

            "total_matches":
            len(
                matching_records
            ),

            "records":
            matching_records[
                :limit
            ]
        }

    if operation == "summary":
        currently_borrowed = 0
        returned = 0
        overdue = 0

        for record in records:
            if record.get(
                "return_date"
            ):
                returned += 1

            else:
                currently_borrowed += 1

                if (
                    get_days_overdue(
                        record
                    ) > 0
                ):
                    overdue += 1

        return {
            "total_records":
            len(
                records
            ),

            "currently_borrowed":
            currently_borrowed,

            "returned":
            returned,

            "overdue":
            overdue
        }

    return {
        "error":
        "Unsupported operation"
    }

def generate_final_answer(
    question,
    result
):
    prompt = f"""
You are a library circulation assistant.

Answer the user's question using ONLY the calculated result below.

The result was calculated by Python from the library records.

Rules:

- Do not invent information.
- Do not change numbers.
- Do not perform additional calculations.
- Use only the provided result.
- Answer naturally and clearly.
- If there are no matching records, say so.
- Keep the answer concise.

USER QUESTION:

{question}

CALCULATED RESULT:

{json.dumps(
    result,
    indent=2,
    ensure_ascii=False
)}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0,
        max_tokens=500
    )

    return (
        response
        .choices[0]
        .message
        .content
    )

@app.get("/")
def home():
    return {
        "message":
        "Library AI Assistant API is running"
    }

@app.post("/ask")
def ask_question(
    data: dict
):
    question = data.get(
        "question",
        ""
    )

    if not isinstance(
        question,
        str
    ):
        return {
            "answer":
            "Invalid question."
        }

    question = question.strip()

    if not question:
        return {
            "answer":
            "Please enter a question."
        }

    try:
        query_plan = (
            create_query_plan(
                question
            )
        )

        print(
            "QUERY PLAN:",
            query_plan
        )
        result = (
            execute_query_plan(
                query_plan
            )
        )
        print(
            "CALCULATED RESULT:",
            result
        )
        answer = (
            generate_final_answer(
                question,
                result
            )
        )
        return {
            "answer":
            answer
        }
    except Exception as error:
        print(
            "ERROR:",
            error
        )
        return {
            "answer":
            "I could not process that question."
        }