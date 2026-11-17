from typing import Annotated

from pydantic import AfterValidator, BaseModel, StringConstraints

from app.auth.email import check_email
from app.users.schemas import UserPublic


def _reject_nul(value: str) -> str:
    # PostgreSQL text cannot hold NUL: without this it would surface as a 500.
    if "\x00" in value:
        raise ValueError("must not contain NUL characters")
    return value


# Every string a client sends to the auth routes.
Text = Annotated[str, AfterValidator(_reject_nul)]


class SignupRequest(BaseModel):
    email: Annotated[Text, AfterValidator(check_email)]
    password: Text
    username: Text
    display_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1), AfterValidator(_reject_nul)
    ]
    account_type: Text


class LoginRequest(BaseModel):
    email: Text
    password: Text


class TokenRequest(BaseModel):
    token: Text


class ForgotPasswordRequest(BaseModel):
    email: Text


class ResetPasswordRequest(BaseModel):
    token: Text
    new_password: Text


class AccountResponse(UserPublic):
    """The signed-in user: the public profile plus the sign-in details only they may see."""

    email: str | None
    email_verified: bool
    providers: list[str]
