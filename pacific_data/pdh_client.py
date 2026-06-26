from __future__ import annotations

import csv
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import requests

from .countries import country_code

BASE_URL = "https://stats-sdmx-disseminate.pacificdata.org/rest"
AGENCY_ID = "SPC"
CACHE_PATH = Path("runtime/cache/dataflows.xml")
CACHE_TTL_SECONDS = 86400
NS = {
    "structure": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure",
    "common": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common",
}


class PDHError(RuntimeError):
    pass


def _get(url: str, timeout: int = 60) -> requests.Response:
    response = requests.get(url, headers={"User-Agent": "pacific-exposure-map/0.1"}, timeout=timeout)
    if response.status_code >= 400:
        raise PDHError(f"PDH request failed {response.status_code}: {response.text[:300]} ({url})")
    return response


def _name(element: ET.Element | None) -> str:
    if element is None:
        return ""
    names = element.findall("common:Name", NS)
    for item in names:
        if item.attrib.get("{http://www.w3.org/XML/1998/namespace}lang") == "en":
            return "".join(item.itertext()).strip()
    return "".join(names[0].itertext()).strip() if names else ""


def list_dataflows(refresh: bool = False) -> list[dict[str, str]]:
    url = f"{BASE_URL}/dataflow/{AGENCY_ID}/all/latest?detail=allstubs"
    fresh = CACHE_PATH.exists() and time.time() - CACHE_PATH.stat().st_mtime < CACHE_TTL_SECONDS
    if fresh and not refresh:
        content = CACHE_PATH.read_bytes()
    else:
        content = _get(url).content
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_bytes(content)
    root = ET.fromstring(content)
    return [
        {"id": item.attrib["id"], "name": _name(item), "version": item.attrib.get("version", "latest")}
        for item in root.findall(".//structure:Dataflow", NS)
        if item.attrib.get("id")
    ]


def search_dataflows(query: str, limit: int = 20) -> list[dict[str, str]]:
    terms = [term.lower() for term in query.split() if term.strip()]
    matches = []
    for flow in list_dataflows():
        haystack = f"{flow['id']} {flow['name']}".lower()
        score = sum(term in haystack for term in terms)
        if score:
            matches.append((score, flow))
    matches.sort(key=lambda item: (-item[0], item[1]["name"].lower()))
    return [flow for _, flow in matches[:limit]]


def get_metadata(dataflow_id: str, version: str = "latest") -> dict[str, Any]:
    url = f"{BASE_URL}/dataflow/{AGENCY_ID}/{dataflow_id}/{version}?references=children&detail=full"
    root = ET.fromstring(_get(url).content)
    flow = root.find(".//structure:Dataflow", NS)
    dsd = root.find(".//structure:DataStructure", NS)
    if flow is None:
        raise PDHError(f"Dataflow not found: {dataflow_id}")
    dimensions = []
    if dsd is not None:
        items = dsd.findall(".//structure:DimensionList/structure:Dimension", NS)
        items += dsd.findall(".//structure:DimensionList/structure:TimeDimension", NS)
        for item in items:
            ref = next((child for child in item.iter() if child.tag.endswith("Ref") and child.attrib.get("class") == "Codelist"), None)
            dimensions.append({
                "id": item.attrib.get("id"),
                "position": int(item.attrib.get("position", "999")),
                "codelist": ref.attrib.get("id") if ref is not None else None,
            })
    dimensions.sort(key=lambda item: item["position"])
    return {"id": dataflow_id, "name": _name(flow), "version": flow.attrib.get("version", version), "dimensions": dimensions, "source_url": url}


def build_key(metadata: dict[str, Any], filters: dict[str, Any] | None = None, country: str | None = None) -> str:
    filters = filters or {}
    geo = country_code(country)
    parts = []
    for dimension in metadata["dimensions"]:
        dim = dimension["id"]
        if dim == "TIME_PERIOD":
            continue
        value = filters.get(dim, "")
        if dim in {"GEO_PICT", "GEO", "REF_AREA"} and geo and not value:
            value = geo
        if isinstance(value, list):
            value = "+".join(map(str, value))
        parts.append(str(value))
    return ".".join(parts)


def retrieve_data(dataflow_id: str, *, key: str | None = None, filters: dict[str, Any] | None = None,
                  country: str | None = None, start_period: str | None = None,
                  end_period: str | None = None, version: str = "latest") -> dict[str, Any]:
    metadata = get_metadata(dataflow_id, version)
    resolved_key = key if key is not None else build_key(metadata, filters, country)
    params = {"dimensionAtObservation": "AllDimensions", "format": "csvfile"}
    if start_period:
        params["startPeriod"] = start_period
    if end_period:
        params["endPeriod"] = end_period
    url = f"{BASE_URL}/data/{AGENCY_ID},{dataflow_id},{metadata['version']}/{resolved_key}?{urlencode(params)}"
    response = _get(url, timeout=90)
    rows = list(csv.DictReader(response.text.splitlines()))
    if not rows:
        raise PDHError(f"No rows returned for {dataflow_id} key={resolved_key}")
    return {"metadata": metadata, "key": resolved_key, "retrieval_url": url, "rows": rows}

