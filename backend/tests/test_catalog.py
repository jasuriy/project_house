from httpx import AsyncClient


async def test_catalog_lists_choices_limits_and_tech(client: AsyncClient) -> None:
    response = await client.get("/api/v1/catalog")

    assert response.status_code == 200
    body = response.json()
    assert {"id": "mobile_app", "label": "Mobile app"} in body["project_types"]
    assert [c["label"] for c in body["post_languages"]] == ["English", "O'zbek", "Русский"]
    assert body["text_limits"]["name"] == 80
    assert body["upload_rules"]["video"]["max_bytes"] == 300 * 1024 * 1024
    tech = {t["name"]: t for t in body["tech"]}
    assert tech["Next.js"] == {"name": "Next.js", "group": "Frontend", "icon": "nextdotjs"}
    assert tech["pyannote.audio"]["icon"] is None  # no logo in simple-icons: letter badge
    # every technology of the reflex sample is in the catalog
    for name in ["Python", "TypeScript", "JavaScript", "Starlette", "Granian", "Socket.IO"]:
        assert name in tech
