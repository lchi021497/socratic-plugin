class ReferenceParser {
    constructor(pdfText) {
      this.pdfText = pdfText;
      this.references = new Map(); // Store reference number -> full reference text
      this.citations = new Map();  // Store reference number -> array of locations
      this.processedText = '';
    }
  
    // Extract references section and parse individual references
    parseReferences() {
      // Try to find the references section using common headers
      const referenceHeaders = [
        'References', 'REFERENCES', 'Bibliography', 'BIBLIOGRAPHY',
        'Works Cited', 'WORKS CITED', 'Literature Cited', 'LITERATURE CITED'
      ];
  
      let referencesSection = null;
      for (const header of referenceHeaders) {
        const regex = new RegExp(`${header}\\s*(\\n|\\r\\n|\\r)([\\s\\S]+?)(?=(\\n\\s*\\n|$))`, 'i');
        const match = this.pdfText.match(regex);
        if (match) {
          referencesSection = match[2];
          break;
        }
      }
  
      if (!referencesSection) {
        console.warn('References section not found');
        return;
      }
  
      // Parse individual references
      // Match patterns like [1] or 1. or (1) followed by the reference text
      const referenceRegex = /(?:\[(\d+)\]|\(?(\d+)\)|\b(\d+)\.)\s+([^\n]+(?:\n(?!\s*(?:\[?\d+[\].]|\(\d+\)))[^\n]+)*)/g;
      let match;
  
      while ((match = referenceRegex.exec(referencesSection)) !== null) {
        const refNum = match[1] || match[2] || match[3];
        const refText = match[4].replace(/\n/g, ' ').trim();
        this.references.set(refNum, refText);
      }
  
      console.log(`Found ${this.references.size} references`);
    }
  
    // Find citations in the main text
    findCitations() {
      // Remove references section before processing citations
      const mainText = this.pdfText.split(/references|bibliography|works cited/i)[0];
  
      // Look for citation patterns: [1], [1,2], [1-3], (1), etc.
      const citationRegex = /\[(\d+(?:[-–—,\s]*\d+)*)\]|\((\d+(?:[-–—,\s]*\d+)*)\)/g;
      let match;
  
      while ((match = citationRegex.exec(mainText)) !== null) {
        const citationText = match[1] || match[2];
        const position = match.index;
        
        // Handle different citation formats (single, multiple, ranges)
        const references = this.expandCitationRange(citationText);
        
        references.forEach(refNum => {
          if (!this.citations.has(refNum)) {
            this.citations.set(refNum, []);
          }
          this.citations.get(refNum).push({
            position,
            context: this.getContext(mainText, position)
          });
        });
      }
    }
  
    // Helper function to expand citation ranges (e.g., "1-3" to [1,2,3])
    expandCitationRange(citation) {
      const references = new Set();
      const parts = citation.split(/[,\s]+/);
      
      parts.forEach(part => {
        if (part.includes('-') || part.includes('–') || part.includes('—')) {
          const [start, end] = part.split(/[-–—]/);
          for (let i = parseInt(start); i <= parseInt(end); i++) {
            references.add(i.toString());
          }
        } else {
          references.add(part.trim());
        }
      });
  
      return Array.from(references);
    }
  
    // Get surrounding context for a citation
    getContext(text, position, contextLength = 100) {
      const start = Math.max(0, position - contextLength);
      const end = Math.min(text.length, position + contextLength);
      return text.slice(start, end).replace(/\s+/g, ' ').trim();
    }
  
    // Generate report linking references to their citations
    generateReport() {
      let report = '# Reference Analysis Report\n\n';
  
      // Summary statistics
      report += `## Summary\n`;
      report += `- Total references found: ${this.references.size}\n`;
      report += `- Total unique citations found: ${this.citations.size}\n\n`;
  
      // List all references with their citations
      report += `## References and Citations\n\n`;
      
      this.references.forEach((refText, refNum) => {
        report += `### Reference [${refNum}]\n`;
        report += `${refText}\n\n`;
        
        const citations = this.citations.get(refNum) || [];
        if (citations.length > 0) {
          report += `Cited ${citations.length} time(s):\n`;
          citations.forEach(({context}, index) => {
            report += `${index + 1}. "...${context}..."\n\n`;
          });
        } else {
          report += `*No citations found for this reference*\n\n`;
        }
      });
  
      // List uncited references
      const uncitedRefs = Array.from(this.references.keys())
        .filter(refNum => !this.citations.has(refNum));
      
      if (uncitedRefs.length > 0) {
        report += `## Uncited References\n\n`;
        uncitedRefs.forEach(refNum => {
          report += `- [${refNum}] ${this.references.get(refNum)}\n`;
        });
        report += '\n';
      }
  
      // List citations without references
      const unknownCitations = Array.from(this.citations.keys())
        .filter(refNum => !this.references.has(refNum));
      
      if (unknownCitations.length > 0) {
        report += `## Citations Without Matching References\n\n`;
        unknownCitations.forEach(refNum => {
          const citations = this.citations.get(refNum);
          report += `### [${refNum}]\n`;
          citations.forEach(({context}, index) => {
            report += `${index + 1}. "...${context}..."\n`;
          });
          report += '\n';
        });
      }
  
      return report;
    }
  
    // Main processing function
    process() {
      this.parseReferences();
      this.findCitations();
      return this.generateReport();
    }
  }
  
  // Example usage:
  function processReferences(pdfText) {
    const parser = new ReferenceParser(pdfText);
    return parser.process();
  }
  
  // Export for use in browser or Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReferenceParser, processReferences };
  }