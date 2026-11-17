from typing import Annotated

from pydantic import AfterValidator, BaseModel, StringConstraints

from app.auth.email import check_email
from app.users.schemas import UserPublic


class SignupRequest(BaseModel):
    email: Annotated[str, AfterValidator(check_email)]
    password: str
    username: str
    display_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    account_type: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AccountResponse(UserPublic):
    """The signed-in user: the public profile plus the sign-in details only they may see."""

    email: str | None
    email_verified: bool
    providers: list[str]
