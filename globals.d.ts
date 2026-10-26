/**
 * Ambient module declarations for the PDF.js modules used by the internal viewer.
 *
 * The Chrome Extension API types (`chrome.*`) are provided by the `@types/chrome`
 * dev dependency, so we do NOT hand-roll them here.
 */

declare module 'pdfjs-dist/build/pdf' {
  const mod: any;
  export = mod;
}

declare module 'pdfjs-dist/build/pdf.worker?url' {
  const url: string;
  export default url;
}
