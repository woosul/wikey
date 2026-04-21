#!/usr/bin/env python3
"""HWP/HWPX → Markdown (base64 embedded 단일 파일).

스킬 자동 실행 시 이 모듈을 호출한다. 이미지는 `data:<mime>;base64,...` URI로
마크다운 본문에 직접 임베드하여 사이드카 폴더 없는 단일 `.md`를 출력.

CLI:
    python3 skills/unhwp/convert.py <src> <out_dir>

Python 임포트:
    from skills.unhwp.convert import convert_hwp
    md_path = convert_hwp("input.hwp", "out/")
"""
from __future__ import annotations

import argparse
import base64
import mimetypes
import re
import sys
from pathlib import Path


_IMG_LINK = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")


def convert_hwp(src: str | Path, out_dir: str | Path) -> Path:
    """HWP/HWPX → Markdown. 이미지는 base64 data URI로 embed. 단일 파일 출력.

    Args:
        src:     입력 .hwp / .hwpx 경로
        out_dir: 출력 디렉토리 (없으면 생성)

    Returns:
        생성된 .md 파일 경로 (`<out_dir>/<원본파일명>.md`)
    """
    from unhwp import parse

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with parse(str(src)) as r:
        img_map = {
            img.name: (
                f"data:{mimetypes.guess_type(img.name)[0] or 'application/octet-stream'};"
                f"base64,{base64.b64encode(img.data).decode()}"
            )
            for img in r.images
        }
        md = r.markdown

    def _embed(m: re.Match) -> str:
        fname = Path(m.group(2)).name
        uri = img_map.get(fname)
        if uri is None:
            return m.group(0)
        return f"![{m.group(1) or 'image'}]({uri})"

    md = _IMG_LINK.sub(_embed, md)

    md_path = out_dir / (Path(src).name + ".md")
    md_path.write_text(md)
    return md_path


def main() -> None:
    ap = argparse.ArgumentParser(description="HWP/HWPX → Markdown (base64 embedded)")
    ap.add_argument("src", help="Input .hwp / .hwpx")
    ap.add_argument("out_dir", help="Output directory")
    args = ap.parse_args()
    print(convert_hwp(args.src, args.out_dir))


if __name__ == "__main__":
    main()
