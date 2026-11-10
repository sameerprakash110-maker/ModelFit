from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.project_service import ProjectService

router = APIRouter()


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
)
def create_project(
    project_in: ProjectCreate,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Create and persist a new benchmarking project."""
    return ProjectService.create_project(db, project_in)


@router.get(
    "",
    response_model=List[ProjectResponse],
    summary="List all projects",
)
def list_projects(
    skip: int = Query(0, ge=0, description="Pagination skip offset"),
    limit: int = Query(100, ge=1, le=500, description="Max projects to return"),
    db: Session = Depends(get_db),
) -> List[ProjectResponse]:
    """Retrieve all benchmarking projects."""
    return ProjectService.get_projects(db, skip=skip, limit=limit)


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Get project by ID",
)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Retrieve details for a specific project by UUID."""
    return ProjectService.get_project_or_404(db, project_id)


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Update project",
)
def update_project(
    project_id: str,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Update metadata for an existing project."""
    return ProjectService.update_project(db, project_id, project_in)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete project",
)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
) -> None:
    """Delete a project and its associated benchmarks and test cases."""
    ProjectService.delete_project(db, project_id)
