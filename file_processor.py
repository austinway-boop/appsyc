"""
File processor for extracting student responses from various file formats.
Supports: TXT, PDF, DOCX, and images (JPG/PNG) via Claude vision.
"""

import base64
import io
from pathlib import Path

import pdfplumber
from docx import Document
from PIL import Image


SUPPORTED_TEXT_EXTENSIONS = {".txt", ".md"}
SUPPORTED_PDF_EXTENSIONS = {".pdf"}
SUPPORTED_DOCX_EXTENSIONS = {".docx"}
SUPPORTED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

ALL_SUPPORTED = (
    SUPPORTED_TEXT_EXTENSIONS
    | SUPPORTED_PDF_EXTENSIONS
    | SUPPORTED_DOCX_EXTENSIONS
    | SUPPORTED_IMAGE_EXTENSIONS
)


def is_supported(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALL_SUPPORTED


def is_image(filename: str) -> bool:
    return Path(filename).suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS


def extract_text_from_txt(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="replace").strip()


def extract_text_from_pdf(file_bytes: bytes) -> str:
    pages = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
    return "\n\n".join(pages).strip()


def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs).strip()


def encode_image_to_base64(file_bytes: bytes, filename: str) -> dict:
    """Encode an image to base64 and return a Claude-compatible content block."""
    ext = Path(filename).suffix.lower()
    media_type_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    media_type = media_type_map.get(ext, "image/jpeg")

    img = Image.open(io.BytesIO(file_bytes))
    max_dim = 2048
    if max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        img = img.resize(new_size, Image.LANCZOS)

    buf = io.BytesIO()
    fmt = "PNG" if ext == ".png" else "JPEG"
    img.save(buf, format=fmt)
    b64 = base64.standard_b64encode(buf.getvalue()).decode("utf-8")

    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": media_type,
            "data": b64,
        },
    }


def process_file(file_bytes: bytes, filename: str) -> dict:
    """
    Process an uploaded file and return a dict with:
      - "type": "text" or "image"
      - "content": extracted text string, or Claude image content block
      - "filename": original filename
    """
    ext = Path(filename).suffix.lower()

    if ext in SUPPORTED_TEXT_EXTENSIONS:
        return {
            "type": "text",
            "content": extract_text_from_txt(file_bytes),
            "filename": filename,
        }
    elif ext in SUPPORTED_PDF_EXTENSIONS:
        return {
            "type": "text",
            "content": extract_text_from_pdf(file_bytes),
            "filename": filename,
        }
    elif ext in SUPPORTED_DOCX_EXTENSIONS:
        return {
            "type": "text",
            "content": extract_text_from_docx(file_bytes),
            "filename": filename,
        }
    elif ext in SUPPORTED_IMAGE_EXTENSIONS:
        return {
            "type": "image",
            "content": encode_image_to_base64(file_bytes, filename),
            "filename": filename,
        }
    else:
        raise ValueError(f"Unsupported file type: {ext}")
