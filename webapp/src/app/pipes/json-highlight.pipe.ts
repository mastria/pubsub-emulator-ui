import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'jsonHighlight',
  standalone: true
})
export class JsonHighlightPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string, searchTerm?: string): SafeHtml {
    const escaped = this.escapeHtml(value);
    let formatted: string;

    try {
      const parsed = JSON.parse(value);
      const pretty = JSON.stringify(parsed, null, 2);
      formatted = this.highlight(this.escapeHtml(pretty));
    } catch {
      formatted = escaped;
    }

    if (searchTerm && searchTerm.trim().length > 0) {
      formatted = this.highlightSearch(formatted, searchTerm.trim());
    }

    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private highlightSearch(html: string, term: string): string {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Negative lookahead skips matches inside HTML tag attributes
    const re = new RegExp(`(?![^<]*>)(${escapedTerm})`, 'gi');
    return html.replace(re, '<mark class="search-match">$1</mark>');
  }

  private highlight(escaped: string): string {
    // Regex operates on the already entity-escaped string.
    // Matches keys, strings, numbers, booleans, null.
    return escaped.replace(
      /(&quot;)(.*?)(&quot;)(\s*:)?|(\b(?:true|false)\b)|(\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (match, q1, key, q3, colon, bool, nil, num) => {
        if (colon !== undefined) {
          // JSON key
          return `<span class="json-key">${q1}${key}${q3}</span>${colon}`;
        }
        if (q1 !== undefined) {
          // JSON string value
          return `<span class="json-string">${q1}${key}${q3}</span>`;
        }
        if (bool !== undefined) {
          return `<span class="json-boolean">${bool}</span>`;
        }
        if (nil !== undefined) {
          return `<span class="json-null">${nil}</span>`;
        }
        if (num !== undefined) {
          return `<span class="json-number">${num}</span>`;
        }
        return match;
      }
    );
  }
}
