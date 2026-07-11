const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ margin: 50 });
doc.pipe(fs.createWriteStream('complex_test_contract.pdf'));

const text = fs.readFileSync('complex_test_contract.md', 'utf8');

doc.font('Helvetica-Bold').fontSize(16).text('MASTER SERVICES AND DATA PROCESSING AGREEMENT', { align: 'center' });
doc.moveDown(2);

const lines = text.split('\n');

for (const line of lines) {
    if (line.startsWith('# ')) continue; // Skip title as we did it above
    
    if (line.startsWith('## ')) {
        doc.moveDown(1);
        doc.font('Helvetica-Bold').fontSize(14).text(line.replace('## ', ''));
        doc.moveDown(0.5);
    } else if (line.trim().length > 0) {
        let cleanLine = line.replace(/\*\*/g, '').replace(/\*/g, '');
        doc.font('Helvetica').fontSize(11).text(cleanLine, {
            align: 'justify',
            lineGap: 4
        });
        doc.moveDown(0.5);
    }
}

doc.end();
console.log("PDF created successfully using PDFKit!");
