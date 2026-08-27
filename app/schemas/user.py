from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    default_source_lang: str = Field(default="ru", max_length=10)
    default_target_lang: str = Field(default="en", max_length=10)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Raw plaintext password for registration")


class UserRead(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
