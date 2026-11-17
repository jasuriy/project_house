from typing import Literal, get_args

# Display names are the frontend's job. `FieldName` is the single source: the same values drive the
# database CHECK constraint and the API's query validation.
FieldName = Literal["ai-apps", "cv-ml", "web", "mobile", "devtools", "hardware", "data"]
FIELDS: tuple[str, ...] = get_args(FieldName)
