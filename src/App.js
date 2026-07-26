import { useEffect, useState } from "react";

function App() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    fetch("/book_issue_records.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load circulation data");
        }

        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("JSON data must be an array");
        }

        setRecords(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setError("Could not load circulation data.");
        setLoading(false);
      });
  }, []);

  function calculateDaysOverdue(record) {
    if (record.return_date) {
      return 0;
    }

    if (!record.due_date) {
      return null;
    }

    const today = new Date();
    const dueDate = new Date(record.due_date);

    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const difference = today - dueDate;

    const days = Math.floor(
      difference / (1000 * 60 * 60 * 24)
    );

    return days > 0 ? days : 0;
  }

  async function askAssistant() {
    const userQuestion = question.trim();

    if (!userQuestion || aiLoading) {
      return;
    }

    setAiLoading(true);
    setAnswer("");

    try {
      const response = await fetch(
        "https://library-circulation-register-backend.onrender.com/ask",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: userQuestion,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("AI request failed");
      }

      const data = await response.json();

      setAnswer(
        data.answer ||
          "The assistant returned no answer."
      );
    } catch (error) {
      console.error(error);

      setAnswer(
        "Could not connect to the AI assistant. Make sure the FastAPI backend is running."
      );
    } finally {
      setAiLoading(false);
    }
  }

  const filteredRecords = records.filter((record) => {
    const searchText = search.toLowerCase().trim();

    const title = String(
      record.title || ""
    ).toLowerCase();

    const memberName = String(
      record.member_name || ""
    ).toLowerCase();

    const bookId = String(
      record.book_id || ""
    ).toLowerCase();

    const issueId = String(
      record.issue_id || ""
    ).toLowerCase();

    const status = String(
      record.status || ""
    ).toLowerCase();

    const matchesSearch =
      title.includes(searchText) ||
      memberName.includes(searchText) ||
      bookId.includes(searchText) ||
      issueId.includes(searchText);

    const isOverdue =
      calculateDaysOverdue(record) > 0;

    const matchesStatus =
      statusFilter === "all" ||
      status === statusFilter ||
      (
        statusFilter === "overdue" &&
        isOverdue
      );

    return (
      matchesSearch &&
      matchesStatus
    );
  });

  const totalRecords = records.length;

  const currentlyBorrowed = records.filter(
    (record) =>
      !record.return_date &&
      String(
        record.status || ""
      ).toLowerCase() !== "returned"
  ).length;

  const overdueRecords = records.filter(
    (record) =>
      calculateDaysOverdue(record) > 0
  ).length;

  const returnedRecords = records.filter(
    (record) =>
      Boolean(record.return_date) ||
      String(
        record.status || ""
      ).toLowerCase() === "returned"
  ).length;

  const titleBorrowCounts = {};

  records.forEach((record) => {
    const title =
      record.title || "Unknown title";

    titleBorrowCounts[title] =
      (titleBorrowCounts[title] || 0) + 1;
  });

  const mostBorrowedTitles =
    Object.entries(titleBorrowCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background:
            "linear-gradient(135deg, #667eea, #764ba2)",
          color: "white",
        }}
      >
        <h2>
          Loading circulation records...
        </h2>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#fee2e2",
          color: "#991b1b",
        }}
      >
        <h2>{error}</h2>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "30px",
        background:
          "linear-gradient(135deg, #eef2ff, #fdf2f8)",
        fontFamily:
          "Arial, Helvetica, sans-serif",
      }}
    >

      {/* PAGE HEADER */}

      <div
        style={{
          background:
            "linear-gradient(135deg, #4f46e5, #7c3aed)",
          color: "white",
          padding: "28px",
          borderRadius: "18px",
          marginBottom: "25px",
          boxShadow:
            "0 10px 25px rgba(79,70,229,0.25)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "32px",
          }}
        >
          Library Circulation Register
        </h1>

        <p
          style={{
            marginBottom: 0,
            opacity: 0.9,
          }}
        >
          Manage books, borrowers, returns,
          and overdue records
        </p>
      </div>


      {/* FLOATING AI BUTTON */}

      <button
        onClick={() =>
          setAssistantOpen(
            !assistantOpen
          )
        }
        style={{
          position: "fixed",
          bottom: "25px",
          right: "25px",
          width: "68px",
          height: "68px",
          borderRadius: "50%",
          border: "4px solid white",
          background:
            "linear-gradient(135deg, #2563eb, #7c3aed)",
          boxShadow:
            "0 8px 25px rgba(37,99,235,0.4)",
          cursor: "pointer",
          zIndex: 1000,
          padding: "8px",
        }}
      >
        <img
          src="/message.png"
          alt="AI Assistant"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </button>


      {/* AI ASSISTANT WINDOW */}

      {assistantOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "105px",
            right: "25px",
            width: "380px",
            height: "520px",
            background: "#ffffff",
            borderRadius: "18px",
            boxShadow:
              "0 15px 40px rgba(0,0,0,0.25)",
            zIndex: 999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >

          {/* HEADER */}

          <div
            style={{
              padding: "18px",
              background:
                "linear-gradient(135deg, #2563eb, #7c3aed)",
              color: "white",
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
            }}
          >
            <strong
              style={{
                fontSize: "17px",
              }}
            >
              Library Assistant
            </strong>

            <button
              onClick={() =>
                setAssistantOpen(false)
              }
              style={{
                border: "none",
                background: "rgba(255,255,255,0.2)",
                color: "white",
                fontSize: "20px",
                cursor: "pointer",
                borderRadius: "6px",
                width: "32px",
                height: "32px",
              }}
            >
              ✕
            </button>
          </div>


          {/* ANSWER AREA */}

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "18px",
              background: "#f8fafc",
            }}
          >
            {!answer &&
              !aiLoading && (
                <div
                  style={{
                    background: "#e0e7ff",
                    color: "#3730a3",
                    padding: "14px",
                    borderRadius: "12px",
                    lineHeight: "1.5",
                  }}
                >
                  Ask me about books,
                  borrowers, returns,
                  or overdue records.
                </div>
              )}

            {aiLoading && (
              <div
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  padding: "14px",
                  borderRadius: "12px",
                }}
              >
                Assistant is thinking...
              </div>
            )}

            {answer && (
              <div
                style={{
                  padding: "15px",
                  borderRadius: "12px",
                  background: "#ffffff",
                  borderLeft:
                    "5px solid #6366f1",
                  boxShadow:
                    "0 3px 10px rgba(0,0,0,0.08)",
                  lineHeight: "1.6",
                }}
              >
                <strong
                  style={{
                    color: "#4f46e5",
                  }}
                >
                  Assistant
                </strong>

                <p>{answer}</p>
              </div>
            )}
          </div>


          {/* INPUT AREA */}

          <div
            style={{
              padding: "12px",
              background: "#ffffff",
              borderTop:
                "1px solid #e5e7eb",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              placeholder="Ask a question..."
              value={question}
              onChange={(e) =>
                setQuestion(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter"
                ) {
                  askAssistant();
                }
              }}
              style={{
                flex: 1,
                padding: "12px",
                border:
                  "2px solid #c7d2fe",
                borderRadius: "10px",
                outline: "none",
                fontSize: "14px",
              }}
            />

            <button
              onClick={askAssistant}
              disabled={
                aiLoading ||
                !question.trim()
              }
              style={{
                padding:
                  "10px 15px",
                border: "none",
                borderRadius: "10px",
                background:
                  aiLoading ||
                  !question.trim()
                    ? "#cbd5e1"
                    : "#4f46e5",
                color: "white",
                cursor:
                  aiLoading ||
                  !question.trim()
                    ? "not-allowed"
                    : "pointer",
                fontSize: "18px",
              }}
            >
              {aiLoading
                ? "..."
                : "➤"}
            </button>
          </div>

        </div>
      )}


      {/* DASHBOARD CARDS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
          marginBottom: "25px",
        }}
      >

        {/* BORROWED */}

        <div
          style={{
            padding: "22px",
            borderRadius: "16px",
            background:
              "linear-gradient(135deg, #dbeafe, #bfdbfe)",
            borderLeft:
              "6px solid #2563eb",
            boxShadow:
              "0 5px 15px rgba(37,99,235,0.12)",
          }}
        >
          <h3
            style={{
              color: "#1e40af",
            }}
          >
            Currently Borrowed
          </h3>

          <h2
            style={{
              fontSize: "32px",
              color: "#1d4ed8",
            }}
          >
            {currentlyBorrowed}
          </h2>
        </div>


        {/* OVERDUE */}

        <div
          style={{
            padding: "22px",
            borderRadius: "16px",
            background:
              "linear-gradient(135deg, #fee2e2, #fecaca)",
            borderLeft:
              "6px solid #dc2626",
            boxShadow:
              "0 5px 15px rgba(220,38,38,0.12)",
          }}
        >
          <h3
            style={{
              color: "#991b1b",
            }}
          >
            Overdue
          </h3>

          <h2
            style={{
              fontSize: "32px",
              color: "#dc2626",
            }}
          >
            {overdueRecords}
          </h2>
        </div>


        {/* RETURNED */}

        <div
          style={{
            padding: "22px",
            borderRadius: "16px",
            background:
              "linear-gradient(135deg, #dcfce7, #bbf7d0)",
            borderLeft:
              "6px solid #16a34a",
            boxShadow:
              "0 5px 15px rgba(22,163,74,0.12)",
          }}
        >
          <h3
            style={{
              color: "#166534",
            }}
          >
            Returned
          </h3>

          <h2
            style={{
              fontSize: "32px",
              color: "#16a34a",
            }}
          >
            {returnedRecords}
          </h2>
        </div>


        {/* TOTAL */}

        <div
          style={{
            padding: "22px",
            borderRadius: "16px",
            background:
              "linear-gradient(135deg, #fef3c7, #fde68a)",
            borderLeft:
              "6px solid #d97706",
            boxShadow:
              "0 5px 15px rgba(217,119,6,0.12)",
          }}
        >
          <h3
            style={{
              color: "#92400e",
            }}
          >
            Total Records
          </h3>

          <h2
            style={{
              fontSize: "32px",
              color: "#d97706",
            }}
          >
            {totalRecords}
          </h2>
        </div>

      </div>


      {/* MOST BORROWED TITLES */}

      <div
        style={{
          marginBottom: "25px",
          background: "#ffffff",
          borderRadius: "16px",
          padding: "22px",
          boxShadow:
            "0 5px 20px rgba(0,0,0,0.08)",
          borderTop:
            "5px solid #8b5cf6",
        }}
      >
        <h2
          style={{
            color: "#5b21b6",
          }}
        >
          Most Borrowed Titles
        </h2>

        {mostBorrowedTitles.length ===
        0 ? (
          <p>
            No borrowing data available.
          </p>
        ) : (
          <ol>
            {mostBorrowedTitles.map(
              ([title, count]) => (
                <li
                  key={title}
                  style={{
                    marginBottom: "10px",
                    color: "#374151",
                  }}
                >
                  <strong
                    style={{
                      color: "#4f46e5",
                    }}
                  >
                    {title}
                  </strong>{" "}
                  — {count} time
                  {count !== 1
                    ? "s"
                    : ""}{" "}
                  borrowed
                </li>
              )
            )}
          </ol>
        )}
      </div>


      {/* MAIN LAYOUT */}

      <div
        style={{
          display: "flex",
          gap: "30px",
          alignItems:
            "flex-start",
        }}
      >

        {/* LEFT SIDE */}

        <div
          style={{
            flex: 3,
            minWidth: 0,
            background: "#ffffff",
            padding: "22px",
            borderRadius: "16px",
            boxShadow:
              "0 5px 20px rgba(0,0,0,0.08)",
          }}
        >

          {/* SEARCH */}

          <input
            type="text"
            placeholder="Search by title, member, book ID..."
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            style={{
              padding: "12px",
              marginRight: "10px",
              width: "300px",
              border:
                "2px solid #c7d2fe",
              borderRadius: "10px",
              outline: "none",
            }}
          />


          {/* STATUS FILTER */}

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value
              )
            }
            style={{
              padding: "12px",
              border:
                "2px solid #c7d2fe",
              borderRadius: "10px",
              background: "#eef2ff",
              color: "#3730a3",
              cursor: "pointer",
            }}
          >
            <option value="all">
              All
            </option>

            <option value="issued">
              Issued
            </option>

            <option value="returned">
              Returned
            </option>

            <option value="overdue">
              Overdue
            </option>
          </select>


          {/* RECORD COUNT */}

          <p
            style={{
              color: "#6b7280",
              marginTop: "18px",
            }}
          >
            Showing{" "}
            <strong>
              {filteredRecords.length}
            </strong>{" "}
            of{" "}
            <strong>
              {records.length}
            </strong>{" "}
            records
          </p>


          {/* TABLE */}

          {filteredRecords.length ===
          0 ? (
            <p
              style={{
                color: "#6b7280",
              }}
            >
              No matching records found.
            </p>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  borderCollapse:
                    "separate",
                  borderSpacing: 0,
                  width: "100%",
                  overflow: "hidden",
                  borderRadius: "10px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "linear-gradient(135deg, #4f46e5, #6366f1)",
                      color: "white",
                    }}
                  >
                    <th
                      style={{
                        padding: "14px",
                      }}
                    >
                      Issue ID
                    </th>

                    <th
                      style={{
                        padding: "14px",
                      }}
                    >
                      Book ID
                    </th>

                    <th
                      style={{
                        padding: "14px",
                      }}
                    >
                      Title
                    </th>

                    <th
                      style={{
                        padding: "14px",
                      }}
                    >
                      Member Name
                    </th>

                    <th
                      style={{
                        padding: "14px",
                      }}
                    >
                      Issue Date
                    </th>

                    <th
                      style={{
                        padding: "14px",
                      }}
                    >
                      Due Date
                    </th>

                    <th
                      style={{
                        padding: "14px",
                      }}
                    >
                      Return Date
                    </th>

                    <th
                      style={{
                        padding: "14px",
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map(
                    (record, index) => (
                      <tr
                        key={
                          record.issue_id
                        }
                        onClick={() =>
                          setSelectedRecord(
                            record
                          )
                        }
                        style={{
                          cursor:
                            "pointer",
                          background:
                            index % 2 === 0
                              ? "#f8fafc"
                              : "#ffffff",
                        }}
                      >
                        <td
                          style={{
                            padding: "12px",
                          }}
                        >
                          {record.issue_id ||
                            "Unknown"}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                          }}
                        >
                          {record.book_id ||
                            "Unknown"}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            color: "#4f46e5",
                            fontWeight: "bold",
                          }}
                        >
                          {record.title ||
                            "Unknown title"}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                          }}
                        >
                          {record.member_name ||
                            "Unknown member"}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                          }}
                        >
                          {record.issue_date ||
                            "Unknown"}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                          }}
                        >
                          {record.due_date ||
                            "Unknown"}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                          }}
                        >
                          {record.return_date ||
                            "Not returned"}
                        </td>

                        <td
                          style={{
                            padding: "12px",
                            fontWeight: "bold",
                            color:
                              String(
                                record.status ||
                                  ""
                              ).toLowerCase() ===
                              "returned"
                                ? "#16a34a"
                                : "#d97706",
                          }}
                        >
                          {record.status ||
                            "Unknown status"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>


        {/* RIGHT SIDE DETAILS */}

        <div
          style={{
            flex: 1,
            minWidth: "300px",
            background: "#ffffff",
            borderRadius: "16px",
            padding: "22px",
            position: "sticky",
            top: "20px",
            maxHeight:
              "calc(100vh - 40px)",
            overflowY: "auto",
            boxShadow:
              "0 5px 20px rgba(0,0,0,0.08)",
            borderTop:
              "5px solid #06b6d4",
          }}
        >
          {!selectedRecord ? (
            <>
              <h2
                style={{
                  color: "#0891b2",
                }}
              >
                Record Details
              </h2>

              <p
                style={{
                  color: "#6b7280",
                }}
              >
                Click a record from the
                table to view its details.
              </p>
            </>
          ) : (
            <>
              <h2
                style={{
                  color: "#0891b2",
                }}
              >
                Record Details
              </h2>

              {calculateDaysOverdue(
                selectedRecord
              ) !== null ? (
                <h2
                  style={{
                    color:
                      calculateDaysOverdue(
                        selectedRecord
                      ) > 0
                        ? "#dc2626"
                        : "#16a34a",
                  }}
                >
                  {calculateDaysOverdue(
                    selectedRecord
                  ) > 0
                    ? `${calculateDaysOverdue(
                        selectedRecord
                      )} DAYS OVERDUE`
                    : "NOT OVERDUE"}
                </h2>
              ) : (
                <h2
                  style={{
                    color: "#d97706",
                  }}
                >
                  OVERDUE DAYS UNKNOWN
                </h2>
              )}

              <p>
                <strong
                  style={{
                    color: "#0891b2",
                  }}
                >
                  Issue ID:
                </strong>{" "}
                {selectedRecord.issue_id ||
                  "Unknown"}
              </p>

              <p>
                <strong
                  style={{
                    color: "#0891b2",
                  }}
                >
                  Book ID:
                </strong>{" "}
                {selectedRecord.book_id ||
                  "Unknown"}
              </p>

              <p>
                <strong
                  style={{
                    color: "#0891b2",
                  }}
                >
                  Title:
                </strong>{" "}
                {selectedRecord.title ||
                  "Unknown title"}
              </p>

              <p>
                <strong
                  style={{
                    color: "#0891b2",
                  }}
                >
                  Member:
                </strong>{" "}
                {selectedRecord.member_name ||
                  "Unknown member"}
              </p>

              <p>
                <strong
                  style={{
                    color: "#0891b2",
                  }}
                >
                  Issue Date:
                </strong>{" "}
                {selectedRecord.issue_date ||
                  "Unknown"}
              </p>

              <p>
                <strong
                  style={{
                    color: "#0891b2",
                  }}
                >
                  Due Date:
                </strong>{" "}
                {selectedRecord.due_date ||
                  "Unknown"}
              </p>

              <p>
                <strong
                  style={{
                    color: "#0891b2",
                  }}
                >
                  Return Date:
                </strong>{" "}
                {selectedRecord.return_date ||
                  "Not returned"}
              </p>

              <p>
                <strong
                  style={{
                    color: "#0891b2",
                  }}
                >
                  Status:
                </strong>{" "}
                {selectedRecord.status ||
                  "Unknown status"}
              </p>

              <button
                onClick={() =>
                  setSelectedRecord(
                    null
                  )
                }
                style={{
                  padding:
                    "10px 16px",
                  border: "none",
                  borderRadius: "8px",
                  background:
                    "#0891b2",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Close Details
              </button>
            </>
          )}

        </div>

      </div>

    </div>
  );
}

export default App;