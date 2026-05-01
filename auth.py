from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..schemas import RegisterRequest
from ..crud import create_pending_user, authenticate_user
from ..security_jwt import create_access_token
from ..models import User, PendingUser

from ..dependencies import get_current_user


router = APIRouter(prefix="/auth", tags=["Auth"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

#endpoint de la demande d'inscription
@router.post("/register-request")
def register_request(data: RegisterRequest, db: Session = Depends(get_db)):
    # Sécurité rôle
    if data.role not in ["chef", "equipe"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    # Vérification email déjà existant
    if (
        db.query(User).filter_by(email=data.email).first()
        or db.query(PendingUser).filter_by(email=data.email).first()
    ):
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    create_pending_user(db, data)
    return {"message": "Demande envoyée, en attente de validation admin"}

# endpoint pour l'authentifiaction
@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role
    })

    response_data = {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role
    }
    print(f"DEBUG: Login response for {user.email}: {response_data}")
    return response_data

# Important
#username = email
#compatible React / Axios
#pas de refresh token

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name
    }
