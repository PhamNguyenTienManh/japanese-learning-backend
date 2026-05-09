import { GoogleGenAIClient } from "../provider/googleGenAIClient";

export class NotebookAIService {
  private client = new GoogleGenAIClient();

  public async generateNotebookItems(prompt: string): Promise<any[]> {
    const llm = this.client.getModel();

    const fullPrompt = `
あなたは日本語学習アシスタントです。

User request: ${prompt}

IMPORTANT:
- ALWAYS return a JSON array
- No explanation, no markdown
- Each item must have:
  - name (Japanese)
  - notes (Vietnamese meaning)
  - mean (English meaning)
  - phonetic (hiragana/katakana)

Example:
[{"name":"日","notes":"Mặt trời","mean":"Sun","phonetic":"ひ"}]

Generate now:
`;

    const response = await llm.invoke(fullPrompt);

    const content =
      typeof response.content === "string"
        ? response.content
        : JSON.stringify(response.content);

    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/```[\s\S]*?\n?/g, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) return [];

      return parsed.map((item) => ({
        name: item.name ?? "",
        notes: item.notes ?? "",
        mean: item.mean ?? "",
        phonetic: item.phonetic ?? "",
      }));
    } catch (err) {
      console.error("Parse error:", err);
      console.error("Raw:", cleaned);
      return [];
    }
  }
}
