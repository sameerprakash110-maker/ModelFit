from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.exceptions import EntityNotFoundException
from app.models.project import Project
from app.models.test_case import TestCase
from app.schemas.test_case import TestCaseCreate, TestCaseUpdate
from app.utils.logger import logger


class TestCaseService:
    """Service layer managing evaluation test cases / benchmark prompts."""

    @staticmethod
    def get_test_cases(
        db: Session,
        project_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[TestCase]:
        """Fetch a paginated list of test cases, optionally filtered by project_id."""
        query = select(TestCase).order_by(TestCase.created_at.desc())
        if project_id:
            query = query.where(TestCase.project_id == project_id)
        return list(db.scalars(query.offset(skip).limit(limit)).all())

    @staticmethod
    def list_test_cases_for_project(db: Session, project_id: str) -> List[TestCase]:
        """Return all test cases belonging to a specific project.

        Dedicated accessor used by benchmark runners and reporting services that
        need to iterate over every test case for a known project without optional
        filtering overhead.
        """
        query = (
            select(TestCase)
            .where(TestCase.project_id == project_id)
            .order_by(TestCase.created_at.desc())
        )
        return list(db.scalars(query).all())

    @staticmethod
    def get_test_case_by_id(db: Session, test_case_id: str) -> Optional[TestCase]:
        """Fetch test case by ID."""
        query = select(TestCase).where(TestCase.id == test_case_id)
        return db.scalars(query).first()

    @staticmethod
    def get_test_case_or_404(db: Session, test_case_id: str) -> TestCase:
        """Fetch test case by ID or raise EntityNotFoundException."""
        test_case = TestCaseService.get_test_case_by_id(db, test_case_id)
        if not test_case:
            raise EntityNotFoundException("TestCase", test_case_id)
        return test_case

    @staticmethod
    def create_test_case(db: Session, test_case_in: TestCaseCreate) -> TestCase:
        """Create and persist a new test case for an existing project."""
        project = db.scalars(select(Project).where(Project.id == test_case_in.project_id)).first()
        if not project:
            raise EntityNotFoundException("Project", test_case_in.project_id)

        test_case = TestCase(
            project_id=test_case_in.project_id,
            input_prompt=test_case_in.input_prompt,
            expected_behavior=test_case_in.expected_behavior,
            evaluation_criteria=test_case_in.evaluation_criteria,
        )
        db.add(test_case)
        db.commit()
        db.refresh(test_case)
        logger.info(f"Created test case: {test_case.id} for project {test_case.project_id}")
        return test_case

    @staticmethod
    def update_test_case(
        db: Session, test_case_id: str, test_case_in: TestCaseUpdate
    ) -> TestCase:
        """Update an existing test case."""
        test_case = TestCaseService.get_test_case_or_404(db, test_case_id)

        update_data = test_case_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(test_case, field, value)

        db.add(test_case)
        db.commit()
        db.refresh(test_case)
        return test_case

    @staticmethod
    def delete_test_case(db: Session, test_case_id: str) -> None:
        """Delete a test case."""
        test_case = TestCaseService.get_test_case_or_404(db, test_case_id)
        db.delete(test_case)
        db.commit()
        logger.info(f"Deleted test case: {test_case_id}")
