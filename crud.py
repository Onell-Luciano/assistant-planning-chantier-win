from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from uuid import uuid4
from datetime import datetime

from .models import User, PendingUser, GanttExport
from .security import hash_password, verify_password

# ... (existing imports)

def delete_project(db: Session, project_id: int):
    project = db.query(GanttExport).filter(GanttExport.id == project_id).first()
    if project:
        db.delete(project)
        db.commit()
        return True
    return False

def update_project(db: Session, project_id: int, project_name: str, created_at: datetime, description: str):
    project = db.query(GanttExport).filter(GanttExport.id == project_id).first()
    if project:
        project.project_name = project_name
        project.created_at = created_at
        # Update description inside json_data
        if not project.json_data:
            project.json_data = {}
        project.json_data["description"] = description
        flag_modified(project, "json_data")
        db.commit()
        db.refresh(project)
        return project
    return None

#Fonction de création admin
def create_admin_if_not_exists(db: Session):
    admin_email = "admin@gmail.com"
    admin_password = "password"  # local uniquement

    admin = db.query(User).filter_by(email=admin_email).first()
    if admin:
        return

    admin = User(
        email=admin_email,
        password_hash=hash_password(admin_password),
        role="admin",
        first_name="Admin",
        last_name="Local"
    )

    db.add(admin)
    db.commit()


def create_pending_user(db: Session, data):
    pending = PendingUser(
        id=uuid4(),
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        first_name=data.first_name,
        last_name=data.last_name
    )
    db.add(pending)
    db.commit()
    return pending


def get_pending_users(db: Session):
    return db.query(PendingUser).all()

def get_all_users(db: Session):
    return db.query(User).all()


def approve_user(db: Session, pending_id):
    try:
        pending = db.query(PendingUser).filter_by(id=pending_id).first()
        if not pending:
            return None

        user = User(
            email=pending.email,
            password_hash=pending.password_hash,
            role=pending.role,
            first_name=pending.first_name,
            last_name=pending.last_name
        )

        db.add(user)
        db.delete(pending)
        db.commit()
        return user

    except Exception:
        db.rollback()
        raise # rollback() est obligatoire pour éviter les données fantômes.

def reject_user(db: Session, pending_id):
    pending = db.query(PendingUser).filter_by(id=pending_id).first()
    if not pending:
        return False
    db.delete(pending)
    db.commit()
    return True

def delete_user(db: Session, user_id):
    # Utiliser filter pour être plus explicite avec les types UUID de SQLAlchemy
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True

def authenticate_user(db: Session, email: str, password: str):
    user = db.query(User).filter_by(email=email, is_active=True).first()
    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user

#authenticate_user : Centralise la logique d’authentification
#Évite de répéter du code dans les routers
#Facilite les tests
#Compatible version locale et future version prod