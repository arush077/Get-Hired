import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

const MAX_TEXT_LENGTH = 30_000;

export async function extractText(filename, fileBytes) {
  const lower = filename.toLowerCase();
  let text;

  if (lower.endsWith(".pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(fileBytes) });
    const result = await parser.getText();
    text = result.text.trim();
  } else if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: fileBytes });
    text = result.value.trim();
  } else {
    throw new Error("Unsupported file type. Please upload a PDF or DOCX file.");
  }

  if (!text) {
    throw new Error("Could not extract text from the file. It may be image-based or empty.");
  }

  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH);
  }

  return text;
}
