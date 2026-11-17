from typing import Annotated

from pydantic import AfterValidator, BaseModel

from app.auth.email import check_email
from app.users.schemas import UserPublic


def _reject_nul(value: str) -> str:
    # PostgreSQL text cannot hold NUL: without this it would surface as a 500.
    if "\x00" in value:
        raise ValueError("must not contain NUL characters")
    return value


def _stripped_non_blank(value: str) -> str:
    # A validator, not StringConstraints: stacked on NoNulStr, pydantic applies the constraints
    # to the wrapped type in an order where min_length does not see the stripped value.
    value = value.strip()
    if not value:
        raise ValueError("must not be blank")
    return value


# Every string a client sends to the auth routes.
NoNulStr = Annotated[str, AfterValidator(_reject_nul)]


class SignupRequest(BaseModel):
    email: Annotated[NoNulStr, AfterValidator(check_email)]
    password: NoNulStr
    username: NoNulStr
    display_name: Annotated[NoNulStr, AfterValidator(_stripped_non_blank)]
    account_type: NoNulStr


class LoginRequest(BaseModel):
    email: NoNulStr
    password: NoNulStr


class TokenRequest(BaseModel):
    token: NoNulStr


class ForgotPasswordRequest(BaseModel):
    email: NoNulStr


class ResetPasswordRequest(BaseModel):
    token: NoNulStr
    new_password: NoNulStr


class AccountResponse(UserPublic):
    """The signed-in user: the public profile plus the sign-in details only they may see."""

    email: str | None
    email_verified: bool
    providers: list[str]
