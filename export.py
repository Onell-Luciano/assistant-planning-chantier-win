from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Any
from app.utils.excel_export import generate_msp_excel

router = APIRouter()

class TaskItem(BaseModel):
    id: Any
    text: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    duration: Optional[int] = 0
    progress: Optional[float] = 0.0
    parent: Any = 0
    wbs: Optional[str] = ""
    outline_level: Optional[int] = 1
    # Allow other fields
    type: Optional[str] = None
    open: Optional[bool] = True
    color: Optional[str] = None

class LinkItem(BaseModel):
    id: Any
    source: Any
    target: Any
    type: Optional[str] = "0"
    lag: Optional[int] = 0

class ProjectData(BaseModel):
    tasks: List[TaskItem]
    links: List[LinkItem]

@router.post("/excel", summary="Export Project to Excel for MS Project")
async def export_project_to_excel(data: ProjectData):
    try:
        # Convert Pydantic model to dict
        project_dict = data.dict()
        
        # Generate Excel
        excel_file = generate_msp_excel(project_dict)
        
        # Return as downloadable file
        headers = {
            'Content-Disposition': 'attachment; filename="Planning_MSProject.xlsx"'
        }
        return StreamingResponse(
            excel_file, 
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
