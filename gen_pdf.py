from fpdf import FPDF
import re

pdf = FPDF()
pdf.add_page()
pdf.set_auto_page_break(auto=True, margin=15)

pdf.set_font("Helvetica", size=12)

with open("complex_test_contract.md", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            pdf.ln(5)
            continue
            
        if line.startswith("# "):
            pdf.set_font("Helvetica", style="B", size=16)
            pdf.multi_cell(0, 10, line[2:])
            pdf.set_font("Helvetica", size=12)
        elif line.startswith("## "):
            pdf.ln(5)
            pdf.set_font("Helvetica", style="B", size=14)
            pdf.multi_cell(0, 10, line[3:])
            pdf.set_font("Helvetica", size=12)
        else:
            # Remove bold/italic markdown characters for simple pdf rendering
            clean_line = re.sub(r'[*_]{1,2}', '', line)
            pdf.multi_cell(0, 8, clean_line)

pdf.output("complex_test_contract.pdf")
print("PDF created successfully!")
