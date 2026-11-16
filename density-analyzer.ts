/** Estimates how many words are visible in the viewport, to feed Smart Speed. */
export class TextDensityAnalyzer {
  private cachedDensity: number = 0;
  private lastAnalysisTime: number = 0;
  private readonly ANALYSIS_INTERVAL = 2000;

  analyze(): number {
    const now = Date.now();
    if (now - this.lastAnalysisTime < this.ANALYSIS_INTERVAL) {
      return this.cachedDensity;
    }

    const viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const viewportTop = scrollTop;
    const viewportBottom = scrollTop + viewportHeight;

    const textNodes = this.getVisibleTextNodes(viewportTop, viewportBottom);
    let totalWords = 0;

    for (const node of textNodes) {
      const text = node.textContent || '';
      const words = text.trim().split(/\s+/).filter(w => w.length > 0);
      totalWords += words.length;
    }

    this.cachedDensity = totalWords;
    this.lastAnalysisTime = now;
    return totalWords;
  }

  private getVisibleTextNodes(viewportTop: number, viewportBottom: number): Node[] {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
          const rect = parent.getBoundingClientRect();
          const elementTop = rect.top + window.scrollY;
          const elementBottom = elementTop + rect.height;
          if (elementBottom < viewportTop || elementTop > viewportBottom) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes: Node[] = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    return nodes;
  }
}
