# C’est ici que FastAPI reçoit le JSON venant de React.
# Backend/app/main.py
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from .models import Base, GanttExport
from .schemas import GanttExportCreate
from .routers import auth, admin, export
from pydantic import BaseModel
from typing import Dict, Any
from fastapi.middleware.cors import CORSMiddleware
from .crud import create_admin_if_not_exists

# Créer tables si elles n'existent pas
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Création admin local automatique
db = SessionLocal()
try:
    create_admin_if_not_exists(db)
finally:
    db.close()

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(export.router, prefix="/export", tags=["export"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# un “upsert”: 
# Si le projet existe déjà (même project_name) → mettre à jour son JSONB
# Sinon → créer un nouveau projet.
    
class GanttSchema(BaseModel):
    project_name: str
    json_data: Dict[str, Any]


#endpoint /save-json pour le sauvegarde du planning.
@app.post("/save-json")
def save_json(payload: GanttSchema, db: Session = Depends(get_db)):
    # Vérifier si le projet existe déjà
    existing = db.query(GanttExport).filter(GanttExport.project_name == payload.project_name).first()
    
    if existing:
        # Mettre à jour le JSONB existant
        existing.json_data = payload.json_data
        db.commit()
        db.refresh(existing)
        return {"message": "Projet mis à jour", "id": existing.id}
    else:
        # Créer un nouveau projet
        record = GanttExport(project_name=payload.project_name, json_data=payload.json_data)
        db.add(record)
        db.commit()
        db.refresh(record)
        return {"message": "Projet sauvegardé", "id": record.id}

# Endpoint pour lister tous les projets (FastAPI)
@app.get("/gantt/list")
def list_exports(db: Session = Depends(get_db)):
    records = db.query(GanttExport).all()
    return [{"id": r.id, "project_name": r.project_name, "created_at": r.created_at} for r in records]

#Endpoint pour charger un Gantt précis (FastAPI)
@app.get("/gantt/{export_id}")
def get_export(export_id: int, db: Session = Depends(get_db)):
    record = db.query(GanttExport).filter(GanttExport.id == export_id).first()
    if not record:
        return {"error": "Not found"}
    return {
        "id": record.id,
        "project_name": record.project_name,
        "json_data": record.json_data
    }
