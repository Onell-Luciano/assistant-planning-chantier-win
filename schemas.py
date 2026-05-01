# Backend/app/schemas.py
# Pour valider les données entrantes.
from pydantic import BaseModel, EmailStr
from typing import Literal
from datetime import datetime

from typing import Any, Dict

class GanttExportCreate(BaseModel):
    projectName: str
    jsonData: Dict[str, Any]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: Literal["chef", "equipe"] #refusera automatiquement "admin" ou tout autre valeur
    first_name: str | None = None
    last_name: str | None = None


class Login(BaseModel):
    email: EmailStr
    password: str

class ProjectUpdate(BaseModel):
    project_name: str
    created_at: datetime
    description: str
