from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").status_code == 200


def test_list_platforms():
    response = client.get("/api/platforms")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
