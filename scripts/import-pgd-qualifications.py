#!/usr/bin/env python3
"""Import the PGD qualification directory from the locally supplied XLSX file.

The source workbook is read-only. This script intentionally uses only Python's
standard library so it can tolerate the workbook's non-standard style records.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any
from xml.etree import ElementTree as ET
from zipfile import ZipFile


MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
HEADERS = [
    "编号",
    "区域",
    "医疗机构名称",
    "省份",
    "城市",
    "准入技术",
    "性质",
    "试运行评审时间",
    "正式运行评审时间",
    "区域_2",
    "合计",
    "亿康是否有合作（全产品线）",
    "PGT类合作",
    "非PGT合作与否",
]


def cell_column(reference: str) -> str:
    return "".join(char for char in reference if char.isalpha())


def column_name(index: int) -> str:
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def read_sheet_rows(source: Path, sheet_name: str) -> list[dict[str, str]]:
    ns = {"m": MAIN_NS, "r": DOC_REL_NS}
    with ZipFile(source) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", ns):
                shared_strings.append(
                    "".join(node.text or "" for node in item.iter(f"{{{MAIN_NS}}}t"))
                )

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relationship_map = {
            item.attrib["Id"]: item.attrib["Target"]
            for item in relationships.findall(f"{{{PKG_REL_NS}}}Relationship")
        }
        target = None
        for sheet in workbook.findall("m:sheets/m:sheet", ns):
            if sheet.attrib.get("name") == sheet_name:
                target = relationship_map[sheet.attrib[f"{{{DOC_REL_NS}}}id"]]
                break
        if target is None:
            raise ValueError(f"Workbook does not contain sheet: {sheet_name}")

        sheet_path = str(PurePosixPath("xl") / target).replace("xl/xl/", "xl/")
        worksheet = ET.fromstring(archive.read(sheet_path))
        rows: list[dict[str, str]] = []
        for row in worksheet.findall(".//m:sheetData/m:row", ns):
            values: dict[str, str] = {}
            for cell in row.findall("m:c", ns):
                column = cell_column(cell.attrib["r"])
                value_node = cell.find("m:v", ns)
                value = "" if value_node is None else value_node.text or ""
                cell_type = cell.attrib.get("t")
                if cell_type == "s" and value:
                    value = shared_strings[int(value)]
                elif cell_type == "inlineStr":
                    value = "".join(
                        node.text or "" for node in cell.iter(f"{{{MAIN_NS}}}t")
                    )
                values[column] = value.strip()
            rows.append(values)
    return rows


def normalize_date(raw_value: str) -> str | None:
    value = raw_value.strip().replace("‑", "-").replace("–", "-")
    if not value:
        return None
    if "筹建" in value:
        return "筹建中"
    if "申报" in value:
        return "申报中"

    compact = value.replace(" ", "")
    match = re.fullmatch(r"(19\d{2}|20\d{2})(\d{2})(\d{2})", compact)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"

    # Values such as 202608.7 in the source mean 2026-08-07.
    match = re.fullmatch(r"(19\d{2}|20\d{2})(\d{2})\.(\d{1,2})", compact)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{int(match.group(3)):02d}"

    match = re.fullmatch(
        r"(19\d{2}|20\d{2})[./-](\d{1,2})[./-](\d{1,2})(.*)", compact
    )
    if match:
        suffix = match.group(4)
        return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}{suffix}"

    match = re.fullmatch(r"(19\d{2}|20\d{2})[./-](\d{1,2})(.*)", compact)
    if match:
        suffix = match.group(3)
        return f"{match.group(1)}年{int(match.group(2)):02d}月{suffix}"

    if re.fullmatch(r"(19\d{2}|20\d{2})", compact):
        return f"{compact}年"

    if re.fullmatch(r"\d+(?:\.0+)?", compact):
        serial = float(compact)
        if 30_000 <= serial <= 60_000:
            date = datetime(1899, 12, 30) + timedelta(days=serial)
            return date.strftime("%Y-%m-%d")

    # Preserve descriptive notes and ambiguous source values without guessing.
    return f"{value}（原表）" if re.search(r"\d", value) else value


def classify_status(trial_raw: str, formal_raw: str) -> str:
    if formal_raw.strip():
        return "正式运行"
    if "申报" in trial_raw:
        return "申报中的单位"
    if "筹建" in trial_raw:
        return "筹建中单位"
    if trial_raw.strip():
        return "试运行评审"
    # The source owner confirmed that two empty date cells mean formal operation.
    return "正式运行"


def parse_sortable_date(value: str | None) -> datetime | None:
    if not value:
        return None
    match = re.match(r"^(19\d{2}|20\d{2})-(\d{2})-(\d{2})", value)
    if not match:
        return None
    try:
        return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def parse_sortable_period(value: str | None) -> datetime | None:
    exact_date = parse_sortable_date(value)
    if exact_date:
        return exact_date
    if not value:
        return None
    match = re.match(r"^(19\d{2}|20\d{2})年(\d{2})月", value)
    if match:
        return datetime(int(match.group(1)), int(match.group(2)), 1)
    match = re.match(r"^(19\d{2}|20\d{2})年", value)
    if match:
        return datetime(int(match.group(1)), 1, 1)
    return None


def build_directory(source: Path) -> dict[str, Any]:
    sheet_rows = read_sheet_rows(source, "全国PGD资质单位汇总")
    records: list[dict[str, Any]] = []
    for source_row, cells in enumerate(sheet_rows[1:], start=2):
        values = {
            header: cells.get(column_name(index + 1), "")
            for index, header in enumerate(HEADERS)
        }
        hospital = values["医疗机构名称"].strip()
        if not hospital:
            continue
        trial_raw = values["试运行评审时间"].strip()
        formal_raw = values["正式运行评审时间"].strip()
        records.append(
            {
                "sourceRow": source_row,
                "sourceId": values["编号"].strip(),
                "region": values["区域"].strip(),
                "hospital": hospital,
                "province": values["省份"].strip(),
                "city": values["城市"].strip(),
                "technology": values["准入技术"].strip(),
                "nature": values["性质"].strip(),
                "trialReviewDate": normalize_date(trial_raw),
                "formalReviewDate": normalize_date(formal_raw),
                "qualificationStatus": classify_status(trial_raw, formal_raw),
                "yikonCooperation": values["亿康是否有合作（全产品线）"].strip(),
                "pgtCooperation": values["PGT类合作"].strip(),
                "nonPgtCooperation": values["非PGT合作与否"].strip(),
            }
        )

    status_rank = {
        "申报中的单位": 1,
        "筹建中单位": 2,
        "试运行评审": 3,
        "正式运行": 4,
    }
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for record in records:
        key = (record["province"], re.sub(r"\s+", "", record["hospital"]))
        grouped.setdefault(key, []).append(record)

    centers: list[dict[str, Any]] = []
    duplicate_groups: list[dict[str, Any]] = []
    for matches in grouped.values():
        ordered = sorted(
            matches,
            key=lambda item: (status_rank[item["qualificationStatus"]], item["sourceRow"]),
            reverse=True,
        )
        primary = dict(ordered[0])
        for candidate in ordered[1:]:
            for field in (
                "sourceId",
                "region",
                "city",
                "technology",
                "nature",
                "trialReviewDate",
                "formalReviewDate",
                "yikonCooperation",
                "pgtCooperation",
                "nonPgtCooperation",
            ):
                if not primary.get(field) and candidate.get(field):
                    primary[field] = candidate[field]
        source_rows = sorted(item["sourceRow"] for item in matches)
        primary["sourceRows"] = source_rows
        primary.pop("sourceRow", None)
        if len(matches) > 1:
            duplicate_groups.append(
                {"hospital": primary["hospital"], "province": primary["province"], "sourceRows": source_rows}
            )

        quality_notes: list[str] = []
        trial_date = parse_sortable_period(primary.get("trialReviewDate"))
        formal_date = parse_sortable_period(primary.get("formalReviewDate"))
        if trial_date and formal_date and formal_date < trial_date:
            quality_notes.append("正式运行评审时间早于试运行评审时间，请复核原表")
        if len(matches) > 1:
            quality_notes.append("原表存在重复记录，已按最高资质阶段归并")
        primary["dataQualityNotes"] = quality_notes
        centers.append(primary)

    centers.sort(
        key=lambda item: (
            item["province"],
            -status_rank[item["qualificationStatus"]],
            item["hospital"],
        )
    )
    for index, center in enumerate(centers, start=1):
        center["id"] = f"PGD-{index:03d}"

    status_summary = {
        status: sum(center["qualificationStatus"] == status for center in centers)
        for status in status_rank
    }
    province_summary = []
    for province in sorted({center["province"] for center in centers}):
        province_centers = [center for center in centers if center["province"] == province]
        province_summary.append(
            {
                "province": province,
                "total": len(province_centers),
                "formal": sum(item["qualificationStatus"] == "正式运行" for item in province_centers),
                "trial": sum(item["qualificationStatus"] == "试运行评审" for item in province_centers),
                "construction": sum(item["qualificationStatus"] == "筹建中单位" for item in province_centers),
                "application": sum(item["qualificationStatus"] == "申报中的单位" for item in province_centers),
            }
        )
    province_summary.sort(key=lambda item: (-item["total"], item["province"]))

    return {
        "metadata": {
            "sourceFile": source.name,
            "sourceSheet": "全国PGD资质单位汇总",
            "dataDate": "2026-09-01",
            "importedRows": len(records),
            "uniqueCenters": len(centers),
            "provinceCount": len(province_summary),
            "statusSummary": status_summary,
            "duplicateGroups": duplicate_groups,
            "statusRule": "正式运行时间有值或两个评审时间均为空=正式运行；仅试运行时间有值=试运行；文本申报/筹建按对应阶段归类。",
        },
        "provinceSummary": province_summary,
        "centers": centers,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    payload = build_directory(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["metadata"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
