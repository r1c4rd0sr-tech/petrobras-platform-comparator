import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def test_health():
    assert client.get("/api/health").status_code == 200


def test_list_platforms():
    response = client.get("/api/platforms")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
