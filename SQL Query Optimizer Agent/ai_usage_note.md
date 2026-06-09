# AI Usage Note

## What AI Helped With

- **Code generation**: Core agent loop logic, Streamlit UI layout, SQLite utility functions
- **Prompt engineering**: Crafting the system prompt for the SQL optimization LLM call — iterating on how to instruct the model to return SQL in a code block plus bullet-point explanations
- **Architecture decisions**: Agent loop step ordering (validate → explain → schema → LLM → extract → benchmark)
- **Edge case handling**: SQL extraction regex patterns to handle various LLM response formats (markdown blocks, plain text)
- **Test case design**: Generating the pytest test structure and identifying edge cases for validation and timing functions

## What AI Got Wrong / Required Human Fixes

- Initial prompt had the LLM return explanations before the SQL block — reordered so SQL comes first (easier to extract)
- First version of `extract_sql_from_response` only matched exact `sql` fence labels — updated to handle unlabeled code blocks too
- Suggested using `EXPLAIN` (full bytecode) instead of `EXPLAIN QUERY PLAN` — corrected to the more readable plan format
- Timing loop initially only ran once — changed to 5 runs for stable average

## Best Prompts Used

### System prompt for SQL optimization: