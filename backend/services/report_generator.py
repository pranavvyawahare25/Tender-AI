"""
Report generator for evaluation results.
Produces JSON and PDF reports.
"""
import io
import json
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable


def generate_json_report(tender_info, evaluations, criteria, audit_entries=None):
    """Generate a JSON report."""
    report = {
        "report_type": "Tender Evaluation Report",
        "generated_at": datetime.now().isoformat(),
        "tender": {
            "tender_id": tender_info.get("tender_id", ""),
            "filename": tender_info.get("filename", ""),
            "title": tender_info.get("title", "Tender Evaluation"),
        },
        "criteria": criteria,
        "evaluations": evaluations,
        "summary": _build_summary(evaluations),
        "audit_trail": audit_entries or [],
    }
    return json.dumps(report, indent=2, ensure_ascii=False).encode("utf-8")


def generate_pdf_report(tender_info, evaluations, criteria, audit_entries=None):
    """Generate a PDF report using ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm,
                            leftMargin=15*mm, rightMargin=15*mm)
    styles = getSampleStyleSheet()
    # Custom styles
    title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=18,
                                  textColor=colors.HexColor('#1a237e'), spaceAfter=12)
    heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=14,
                                    textColor=colors.HexColor('#283593'), spaceBefore=16, spaceAfter=8)
    normal_style = styles['Normal']

    elements = []

    # Title
    elements.append(Paragraph("Tender Evaluation Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", normal_style))
    elements.append(Spacer(1, 12))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a237e')))
    elements.append(Spacer(1, 12))

    # Tender Info
    elements.append(Paragraph("Tender Information", heading_style))
    info_data = [
        ["Tender ID", tender_info.get("tender_id", "N/A")],
        ["Document", tender_info.get("filename", "N/A")],
    ]
    t = Table(info_data, colWidths=[120, 350])
    t.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 12))

    # Criteria
    elements.append(Paragraph("Eligibility Criteria", heading_style))
    crit_header = ["#", "Criterion", "Required Value", "Type"]
    crit_data = [crit_header]
    for i, c in enumerate(criteria, 1):
        crit_data.append([str(i), c.get("criterion", ""), c.get("value", ""), c.get("type", "")])

    t = Table(crit_data, colWidths=[30, 200, 140, 100])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 16))

    # Per-bidder evaluation
    elements.append(Paragraph("Bidder Evaluations", heading_style))

    for eval_data in evaluations:
        bidder_name = eval_data.get("bidder_name", eval_data.get("bidder_id", "Unknown"))
        overall = eval_data.get("overall_decision", "NEED_REVIEW")
        color_map = {"PASS": "#2e7d32", "FAIL": "#c62828", "NEED_REVIEW": "#f57f17"}
        decision_color = color_map.get(overall, "#333")

        elements.append(Paragraph(
            f'<b>{bidder_name}</b> — <font color="{decision_color}"><b>{overall}</b></font>',
            ParagraphStyle('BidderName', parent=normal_style, fontSize=12, spaceBefore=12, spaceAfter=6)
        ))

        results = eval_data.get("results", [])
        if results:
            res_header = ["Criterion", "Bidder Value", "Decision", "Reason"]
            res_data = [res_header]
            for r in results:
                decision = r.get("decision", "")
                res_data.append([
                    r.get("criterion", "")[:40],
                    r.get("bidder_value", ""),
                    decision,
                    r.get("reason", "")[:60],
                ])

            t = Table(res_data, colWidths=[140, 90, 80, 160])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#37474f')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
            ]))
            elements.append(t)

        elements.append(Spacer(1, 8))

    # Summary
    summary = _build_summary(evaluations)
    elements.append(Spacer(1, 12))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a237e')))
    elements.append(Paragraph("Summary", heading_style))

    sum_data = [
        ["Category", "Bidders"],
        ["Eligible", ", ".join(summary["eligible"]) or "None"],
        ["Not Eligible", ", ".join(summary["not_eligible"]) or "None"],
        ["Needs Review", ", ".join(summary["needs_review"]) or "None"],
    ]
    t = Table(sum_data, colWidths=[120, 350])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)

    doc.build(elements)
    return buffer.getvalue()


def _build_summary(evaluations):
    """Build summary from evaluations."""
    eligible = []
    not_eligible = []
    needs_review = []
    for ev in evaluations:
        name = ev.get("bidder_name", ev.get("bidder_id", "Unknown"))
        overall = ev.get("overall_decision", "NEED_REVIEW")
        if overall == "PASS":
            eligible.append(name)
        elif overall == "FAIL":
            not_eligible.append(name)
        else:
            needs_review.append(name)
    return {"eligible": eligible, "not_eligible": not_eligible, "needs_review": needs_review}
