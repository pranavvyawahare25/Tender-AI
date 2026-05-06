"""
Reasoned-order PDF generator — produces a CVC-compliant rejection /
clearance letter for a single bidder against a single tender.

Why this exists: most CRPF tender appeals stem from a missing reasoned
order. CVC's Procurement Manual and GFR Rule 173 both require that any
disqualification or clearance be supported by a written, criterion-by-
criterion reasoning. TenderAI auto-generates that letter from the
evaluation data already in the system.

Public API:
    generate_reasoned_order(tender, bidder_name, evaluation, criteria) -> bytes
"""
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak
)


def _decision_label(d: str) -> str:
    return {
        "PASS": "FOUND ELIGIBLE",
        "FAIL": "DISQUALIFIED",
        "NEED_REVIEW": "FLAGGED FOR MANUAL REVIEW",
    }.get(d, d)


def _decision_color(d: str) -> str:
    return {
        "PASS": "#1B5E20",
        "FAIL": "#B71C1C",
        "NEED_REVIEW": "#E65100",
    }.get(d, "#222")


def generate_reasoned_order(tender_info: dict,
                            bidder_name: str,
                            evaluation: dict,
                            criteria: list[dict]) -> bytes:
    """
    Returns the PDF as bytes. Caller decides where to write it.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=18*mm, bottomMargin=20*mm, leftMargin=20*mm, rightMargin=20*mm,
        title=f"Reasoned Order — {bidder_name}",
        author="CRPF Procurement (TenderAI-generated)",
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle('RO_Title', parent=styles['Title'], fontSize=14,
                           textColor=colors.HexColor('#0A1628'),
                           alignment=1, spaceAfter=4, fontName='Helvetica-Bold')
    subtitle = ParagraphStyle('RO_Sub', parent=styles['Normal'], fontSize=10,
                              textColor=colors.HexColor('#475569'),
                              alignment=1, spaceAfter=12)
    h = ParagraphStyle('RO_H', parent=styles['Heading2'], fontSize=11,
                       textColor=colors.HexColor('#0A1628'),
                       spaceBefore=10, spaceAfter=4, fontName='Helvetica-Bold')
    body = ParagraphStyle('RO_Body', parent=styles['Normal'], fontSize=10, leading=14)
    small = ParagraphStyle('RO_Small', parent=body, fontSize=8.5,
                           textColor=colors.HexColor('#475569'))

    el = []

    # ── Letterhead ────────────────────────────────────────────────
    el.append(Paragraph("GOVERNMENT OF INDIA", title))
    el.append(Paragraph("MINISTRY OF HOME AFFAIRS · CENTRAL RESERVE POLICE FORCE", subtitle))
    el.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0A1628')))
    el.append(Spacer(1, 6))

    # ── Document number & date ────────────────────────────────────
    tender_id = tender_info.get("tender_id", "—")
    today = datetime.now().strftime("%d %B %Y")
    bidder_id = evaluation.get("bidder_id", "—")

    meta_data = [
        ["File No.",  f"CRPF/PROC/{tender_id[:8].upper()}/{datetime.now().year}"],
        ["Date",      today],
        ["Subject",   f"Reasoned order on the bid submitted by {bidder_name} "
                      f"in response to NIT {tender_id}"],
    ]
    t = Table(meta_data, colWidths=[35*mm, 130*mm])
    t.setStyle(TableStyle([
        ('FONTNAME',  (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE',  (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#0A1628')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1E293B')),
        ('VALIGN',    (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING',    (0, 0), (-1, -1), 4),
    ]))
    el.append(t)
    el.append(Spacer(1, 8))

    # ── Statutory preamble ─────────────────────────────────────────
    el.append(Paragraph("Statutory basis", h))
    el.append(Paragraph(
        "This order is issued under and in pursuance of <b>Rule 173 of the General "
        "Financial Rules, 2017</b>, the <b>Central Vigilance Commission's Manual "
        "for Procurement of Goods, 2022</b>, and the eligibility criteria recorded "
        "in the said Notice Inviting Tender. Every finding below is recorded with "
        "the supporting evidence and the document reference relied upon, in "
        "compliance with the principles of natural justice and the audit "
        "requirements of the Comptroller and Auditor-General of India.",
        body,
    ))
    el.append(Spacer(1, 8))

    # ── Bidder & overall finding ───────────────────────────────────
    overall = evaluation.get("overall_decision", "NEED_REVIEW")
    overall_label = _decision_label(overall)
    overall_color = _decision_color(overall)

    el.append(Paragraph("Bidder &amp; outcome", h))
    summary_data = [
        ["Bidder name",       bidder_name],
        ["Bidder reference",  bidder_id],
        ["Total criteria evaluated", str(len(evaluation.get("results", [])))],
        ["Pass · Fail · Review",
         f"{evaluation.get('pass_count', 0)} · "
         f"{evaluation.get('fail_count', 0)} · "
         f"{evaluation.get('review_count', 0)}"],
        ["FINDING", overall_label],
    ]
    t = Table(summary_data, colWidths=[55*mm, 110*mm])
    t.setStyle(TableStyle([
        ('FONTNAME',  (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE',  (0, 0), (-1, -1), 9.5),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#0A1628')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1E293B')),
        ('FONTNAME',  (1, -1), (1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor(overall_color)),
        ('VALIGN',    (0, 0), (-1, -1), 'TOP'),
        ('GRID',      (0, 0), (-1, -1), 0.3, colors.HexColor('#CBD5E1')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F8FAFC')),
    ]))
    el.append(t)
    el.append(Spacer(1, 10))

    # ── Per-criterion reasoning ────────────────────────────────────
    el.append(Paragraph("Criterion-by-criterion reasoning", h))
    rows = [["#", "Criterion (required value)", "Bidder value", "Finding", "Reason &amp; evidence"]]
    for i, r in enumerate(evaluation.get("results", []), start=1):
        decision = r.get("decision", "")
        finding = _decision_label(decision)
        reason  = r.get("reason", "—")
        doc_src = r.get("document", "")
        page    = r.get("page", 0)
        evidence = reason
        if doc_src:
            evidence += f"<br/><i>Source: {doc_src}{f' (p.{page})' if page else ''}</i>"
        if r.get("overridden"):
            evidence += f"<br/><b>Override:</b> {r.get('override_reason', '')}"
        rows.append([
            str(i),
            r.get("criterion", "—"),
            r.get("bidder_value", "—"),
            Paragraph(f'<b><font color="{_decision_color(decision)}">{finding}</font></b>',
                      ParagraphStyle('Cell', parent=body, fontSize=8, leading=10)),
            Paragraph(evidence, ParagraphStyle('Cell', parent=body, fontSize=8, leading=10)),
        ])

    t = Table(rows, colWidths=[10*mm, 50*mm, 30*mm, 25*mm, 55*mm], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0A1628')),
        ('TEXTCOLOR',  (0, 0), (-1, 0), colors.white),
        ('FONTNAME',   (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE',   (0, 0), (-1, -1), 8),
        ('VALIGN',     (0, 0), (-1, -1), 'TOP'),
        ('GRID',       (0, 0), (-1, -1), 0.3, colors.HexColor('#CBD5E1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
    ]))
    el.append(t)
    el.append(Spacer(1, 10))

    # ── Tamper note (if any) ───────────────────────────────────────
    tamper = evaluation.get("tamper")
    if tamper and tamper.get("max_severity"):
        sev = tamper["max_severity"].upper()
        el.append(Paragraph("Document integrity note", h))
        el.append(Paragraph(
            f"<b>Severity: {sev}.</b> "
            f"{tamper.get('summary', '—')} "
            f"This note is recorded in the audit trail and was considered while "
            f"finalising the decisions above.",
            body,
        ))
        el.append(Spacer(1, 6))

    # ── Operative paragraph ────────────────────────────────────────
    el.append(Paragraph("Operative paragraph", h))
    if overall == "PASS":
        op_text = (
            f"In view of the foregoing, the bid submitted by <b>{bidder_name}</b> "
            f"is found to satisfy every eligibility criterion specified in the said "
            f"Notice Inviting Tender. The bidder is therefore <b>FOUND ELIGIBLE</b> "
            f"to proceed to the next stage of the procurement process."
        )
    elif overall == "FAIL":
        op_text = (
            f"In view of the foregoing, the bid submitted by <b>{bidder_name}</b> "
            f"does not satisfy one or more mandatory eligibility criteria specified "
            f"in the said Notice Inviting Tender. The bidder is therefore "
            f"<b>DISQUALIFIED</b> at the technical evaluation stage. The grounds "
            f"for disqualification, the supporting evidence, and the source documents "
            f"are all recorded above."
        )
    else:
        op_text = (
            f"In view of the foregoing, certain eligibility criteria for the bid "
            f"submitted by <b>{bidder_name}</b> could not be conclusively determined "
            f"from the documents on record. The matter is <b>FLAGGED FOR MANUAL "
            f"REVIEW</b> by a senior procurement officer, who shall record a "
            f"reasoned finding before the bid is taken forward or rejected."
        )
    el.append(Paragraph(op_text, body))
    el.append(Spacer(1, 8))

    # ── Right of appeal ────────────────────────────────────────────
    el.append(Paragraph("Right of appeal &amp; representation", h))
    el.append(Paragraph(
        "The bidder may, within <b>30 days</b> from the date of issue of this order, "
        "submit a representation to the undersigned along with any additional "
        "documents the bidder considers relevant. Such representation will be "
        "considered before the procurement is concluded. This order is also "
        "open to scrutiny under the Right to Information Act, 2005 (Section 4 "
        "proactive disclosure).",
        body,
    ))
    el.append(Spacer(1, 16))

    # ── Signature block ────────────────────────────────────────────
    el.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#CBD5E1')))
    el.append(Spacer(1, 18))
    sig = [
        ["", "(Signature)"],
        ["", "Authorised Procurement Officer"],
        ["", "CRPF — Directorate General"],
        ["", "Place: New Delhi"],
        ["", f"Date: {today}"],
        ["", "Digital Signature Certificate (DSC) attached separately."],
    ]
    t = Table(sig, colWidths=[100*mm, 65*mm])
    t.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1E293B')),
        ('FONTNAME', (1, 0), (1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING',    (0, 0), (-1, -1), 2),
    ]))
    el.append(t)
    el.append(Spacer(1, 10))
    el.append(Paragraph(
        "This reasoned order was generated by TenderAI from the evaluation data "
        "stored in the platform's audit log. Every finding is traceable to its "
        "source document, page, and confidence score in the corresponding "
        "audit pack.",
        small,
    ))

    doc.build(el)
    return buffer.getvalue()
