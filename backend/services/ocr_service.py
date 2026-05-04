"""
OCR Service for the Tender Evaluation Platform.
Handles multi-strategy document text extraction:
  1. Native PDF text via PyMuPDF (fast, accurate)
  2. Scanned PDF / Images via Tesseract OCR
  3. DOCX via python-docx
"""
import os
from typing import Optional

import fitz  # PyMuPDF
from PIL import Image

from config import OCR_CONFIDENCE_THRESHOLD, TESSERACT_CONFIG, PDF_DPI

# Try importing optional dependencies
try:
    import pytesseract
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

try:
    from docx import Document as DocxDocument
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False


class PageResult:
    """Result of processing a single page."""
    def __init__(self, page_num: int, text: str, confidence: float = 1.0, method: str = "native"):
        self.page_num = page_num
        self.text = text
        self.confidence = confidence
        self.method = method  # "native", "ocr", "docx"

    def to_dict(self):
        return {
            "page_num": self.page_num,
            "text": self.text,
            "confidence": self.confidence,
            "method": self.method,
        }


class OCRResult:
    """Complete result of document processing."""
    def __init__(self, filename: str, full_text: str, pages: list[PageResult], avg_confidence: float):
        self.filename = filename
        self.full_text = full_text
        self.pages = pages
        self.avg_confidence = avg_confidence

    def to_dict(self):
        return {
            "filename": self.filename,
            "full_text": self.full_text,
            "pages": [p.to_dict() for p in self.pages],
            "avg_confidence": self.avg_confidence,
        }


def process_document(filepath: str) -> OCRResult:
    """
    Process a document file and extract text.
    Automatically selects the best extraction method.
    """
    ext = os.path.splitext(filepath)[1].lower()
    filename = os.path.basename(filepath)

    if ext == ".pdf":
        return _process_pdf(filepath, filename)
    elif ext == ".docx":
        return _process_docx(filepath, filename)
    elif ext in {".png", ".jpg", ".jpeg", ".tiff", ".bmp"}:
        return _process_image(filepath, filename)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def _process_pdf(filepath: str, filename: str) -> OCRResult:
    """
    Process a PDF: try native text extraction first, fall back to OCR.
    """
    doc = fitz.open(filepath)
    pages = []
    has_text = False

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text").strip()

        if text and len(text) > 50:
            # Native text extraction succeeded
            pages.append(PageResult(
                page_num=page_num + 1,
                text=text,
                confidence=0.98,
                method="native"
            ))
            has_text = True
        else:
            # Fall back to OCR for this page
            ocr_result = _ocr_pdf_page(page, page_num + 1)
            pages.append(ocr_result)
            if ocr_result.text:
                has_text = True

    doc.close()

    full_text = "\n\n".join(p.text for p in pages if p.text)
    avg_conf = sum(p.confidence for p in pages) / max(len(pages), 1)

    return OCRResult(
        filename=filename,
        full_text=full_text,
        pages=pages,
        avg_confidence=avg_conf
    )


def _ocr_pdf_page(page, page_num: int) -> PageResult:
    """OCR a single PDF page using Tesseract."""
    if not HAS_TESSERACT:
        return PageResult(page_num=page_num, text="", confidence=0.0, method="ocr_unavailable")

    try:
        # Render page to image
        pix = page.get_pixmap(dpi=PDF_DPI)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        # Run Tesseract with confidence data
        data = pytesseract.image_to_data(img, config=TESSERACT_CONFIG, output_type=pytesseract.Output.DICT)

        # Calculate average confidence (exclude -1 values which indicate no text)
        confidences = [int(c) for c in data["conf"] if int(c) > 0]
        avg_conf = (sum(confidences) / len(confidences) / 100.0) if confidences else 0.0

        # Extract text
        text = pytesseract.image_to_string(img, config=TESSERACT_CONFIG).strip()

        return PageResult(
            page_num=page_num,
            text=text,
            confidence=avg_conf,
            method="ocr"
        )
    except Exception as e:
        return PageResult(
            page_num=page_num,
            text=f"[OCR Error: {str(e)}]",
            confidence=0.0,
            method="ocr_error"
        )


def _process_image(filepath: str, filename: str) -> OCRResult:
    """Process an image file using Tesseract OCR."""
    if not HAS_TESSERACT:
        return OCRResult(
            filename=filename,
            full_text="[Tesseract not available]",
            pages=[PageResult(1, "[Tesseract not available]", 0.0, "ocr_unavailable")],
            avg_confidence=0.0
        )

    try:
        img = Image.open(filepath)

        # Get confidence data
        data = pytesseract.image_to_data(img, config=TESSERACT_CONFIG, output_type=pytesseract.Output.DICT)
        confidences = [int(c) for c in data["conf"] if int(c) > 0]
        avg_conf = (sum(confidences) / len(confidences) / 100.0) if confidences else 0.0

        text = pytesseract.image_to_string(img, config=TESSERACT_CONFIG).strip()

        page = PageResult(page_num=1, text=text, confidence=avg_conf, method="ocr")
        return OCRResult(
            filename=filename,
            full_text=text,
            pages=[page],
            avg_confidence=avg_conf
        )
    except Exception as e:
        return OCRResult(
            filename=filename,
            full_text=f"[OCR Error: {str(e)}]",
            pages=[PageResult(1, f"[OCR Error: {str(e)}]", 0.0, "ocr_error")],
            avg_confidence=0.0
        )


def _process_docx(filepath: str, filename: str) -> OCRResult:
    """Process a DOCX file using python-docx."""
    if not HAS_DOCX:
        return OCRResult(
            filename=filename,
            full_text="[python-docx not available]",
            pages=[PageResult(1, "[python-docx not available]", 0.0, "unavailable")],
            avg_confidence=0.0
        )

    try:
        doc = DocxDocument(filepath)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        full_text = "\n".join(paragraphs)

        # DOCX is direct text, so high confidence
        page = PageResult(page_num=1, text=full_text, confidence=0.99, method="docx")
        return OCRResult(
            filename=filename,
            full_text=full_text,
            pages=[page],
            avg_confidence=0.99
        )
    except Exception as e:
        return OCRResult(
            filename=filename,
            full_text=f"[DOCX Error: {str(e)}]",
            pages=[PageResult(1, f"[DOCX Error: {str(e)}]", 0.0, "error")],
            avg_confidence=0.0
        )
