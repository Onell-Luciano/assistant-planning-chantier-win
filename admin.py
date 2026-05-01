from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from ..database import SessionLocal
from ..crud import get_pending_users, approve_user, delete_project, get_all_users, update_project, reject_user, delete_user
from ..models import User, GanttExport
from ..schemas import ProjectUpdate
from ..dependencies import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/pending-users")#liste des demandes d'inscription
def list_pending(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    return get_pending_users(db)


@router.get("/approved-users")#liste de inscriptions approuvés
def list_approved(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    return get_all_users(db)
    
@router.delete("/delete-approved-user/{user_id}")#Licencier (supprimer) un utilisateur
def delete_user_route(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    try:
        from uuid import UUID
        user_uuid = UUID(user_id)
        print(f"Tentative de suppression de l'utilisateur (UUID): {user_uuid}")
        success = delete_user(db, user_uuid)
    except ValueError:
        print(f"ID invalide fourni: {user_id}")
        raise HTTPException(status_code=400, detail="ID d'utilisateur invalide")

    if not success:
        print(f"Utilisateur non trouvé dans la base: {user_id}")
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    return {"message": "Utilisateur licencié avec succès"}


@router.post("/approve/{pending_id}")#Approbation d'une demande d'inscription
def approve(
    pending_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    user = approve_user(db, pending_id)
    if not user:
        raise HTTPException(status_code=404, detail="Not found")

    return {"message": "Utilisateur validé"}

@router.delete("/reject/{pending_id}")#Rejet d'une demande d'inscription
def reject(
    pending_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    success = reject_user(db, pending_id)
    if not success:
        raise HTTPException(status_code=404, detail="Not found")

    return {"message": "Utilisateur rejeté"}

@router.get("/projects")#liste des projets
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    projects = db.query(GanttExport).all()
    return [{
        "id": p.id, 
        "project_name": p.project_name,
        "created_at": p.created_at,
        "description": p.json_data.get("description", "") if p.json_data else ""
    } for p in projects]

@router.delete("/projects/{project_id}")#Supprimer un projet
def delete_project_route(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    success = delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Projet non trouvé")

    return {"message": "Projet supprimé avec succès"}


@router.put("/projects/{project_id}")#Mettre à jour un projet
def update_project_route(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
        
    updated = update_project(
        db, 
        project_id, 
        project_update.project_name, 
        project_update.created_at, 
        project_update.description
    )
    if not updated:
         raise HTTPException(status_code=404, detail="Projet non trouvé")
         
    return {"message": "Projet mis à jour"}

