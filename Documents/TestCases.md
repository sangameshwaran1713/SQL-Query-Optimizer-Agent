#TEST_CASE : 1

| Field           | Value                                |
| --------------- | ------------------------------------ |
| Test ID         | TC-001                               |
| Module          | Demo Database Mode                   |
| Input           | Select Aggregation with JOIN query   |
| Expected Output | Optimized SQL generated              |
| Actual Output   | Optimized SQL generated successfully |
| Status          | PASS                                 |

#TEST_CASE : 2

| Field           | Value                                |
| --------------- | ------------------------------------ |
| Test ID         | TC-002                               |
| Module          | Demo Database Mode                   |
| Input           | Select Aggregation with JOIN query   |
| Expected Output | Optimized SQL generated              |
| Actual Output   | Optimized SQL generated successfully |
| Status          | PASS                                 |

TEST_CASE:3:git
| Field           | Value                    |
| --------------- | ------------------------ |
| Test ID         | TC-003                   |
| Module          | Query + Plan Mode        |
| Input           | SQL query + EXPLAIN PLAN |
| Expected Output | Query analysis generated |
| Actual Output   | Analysis generated       |
| Status          | PASS                     |
