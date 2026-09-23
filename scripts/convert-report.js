const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = require('docx');
const fs = require('fs');
const path = require('path');

// Read the markdown file
const mdPath = '/home/admin/.openclaw/workspace/Fiestaflare-市场分析报告-2026-09-21.md';
const mdContent = fs.readFileSync(mdPath, 'utf8');

// Simple markdown to docx converter
function markdownToDocx(content) {
  const paragraphs = [];
  const lines = content.split('\n');
  
  let inTable = false;
  let tableRows = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip horizontal rules
    if (line === '---' || line === '***' || line === '___') {
      continue;
    }
    
    // Table handling
    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      
      // Skip table separator lines
      if (line.match(/^\|[\s\-:|]+\|$/)) {
        continue;
      }
      
      // Parse table row
      const cells = line.split('|').filter(c => c.trim() !== '');
      tableRows.push(cells.map(cell => new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text: cell.trim(), size: 22 })]
        })]
      })));
      continue;
    } else if (inTable) {
      // End of table
      paragraphs.push(new Table({
        rows: [new TableRow({ children: tableRows[0] }), ...tableRows.slice(1).map(row => new TableRow({ children: row }))],
        width: { size: 100, type: WidthType.PERCENTAGE }
      }));
      inTable = false;
      tableRows = [];
    }
    
    // Headings
    if (line.startsWith('# ')) {
      paragraphs.push(new Paragraph({
        text: line.substring(2),
        heading: HeadingLevel.TITLE,
        spacing: { after: 400 }
      }));
    } else if (line.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        text: line.substring(3),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 }
      }));
    } else if (line.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        text: line.substring(4),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 }
      }));
    } else if (line.startsWith('#### ')) {
      paragraphs.push(new Paragraph({
        text: line.substring(5),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 }
      }));
    }
    // Bullet lists
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.substring(2), size: 22 })],
        bullet: { level: 0 },
        spacing: { after: 100 }
      }));
    }
    // Numbered lists
    else if (line.match(/^\d+\.\s/)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: match[2], size: 22 })],
          numbering: { reference: 'default-numbering', level: 0 },
          spacing: { after: 100 }
        }));
      }
    }
    // Regular paragraph
    else if (line.length > 0) {
      // Clean up markdown formatting
      let cleanText = line
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Bold
        .replace(/\*(.*?)\*/g, '$1')      // Italic
        .replace(/`(.*?)`/g, '$1')        // Code
        .replace(/\[(.*?)\]\(.*?\)/g, '$1'); // Links
      
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: cleanText, size: 22 })],
        spacing: { after: 100 }
      }));
    }
  }
  
  return paragraphs;
}

async function convert() {
  const paragraphs = markdownToDocx(mdContent);
  
  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{
          level: 0,
          format: 'decimal',
          text: '%1.',
          alignment: 'start'
        }]
      }]
    },
    sections: [{
      properties: {},
      children: paragraphs
    }]
  });
  
  const buffer = await Packer.toBuffer(doc);
  
  // Save to public folder
  const outputPath = path.join(__dirname, '..', 'public', 'Fiestaflare-市场分析报告-2026-09-21.docx');
  fs.writeFileSync(outputPath, buffer);
  
  console.log('Document created:', outputPath);
}

convert().catch(console.error);
