import { GoogleGenAIClient } from "../provider/googleGenAIClient";
import { startActiveObservation } from "@langfuse/tracing";

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

    const response = await startActiveObservation(
      "generate-notebook-items",
      async (generation) => {
        generation.update({
          input: fullPrompt,
          model: "gemini-2.5-flash",
          metadata: {
            feature: "notebook-items",
          },
        });

        const result = await llm.invoke(fullPrompt);
        const usage = this.getUsageDetails(result);
        generation.update({
          output: result?.content,
          ...(usage ? { usageDetails: usage } : {}),
        });
        return result;
      },
      { asType: "generation" },
    );

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

  private getUsageDetails(response: any) {
    const usage =
      response?.usage_metadata ||
      response?.response_metadata?.usageMetadata ||
      response?.response_metadata?.usage_metadata;

    if (!usage || typeof usage !== "object") return null;

    const input =
      usage.input_tokens ??
      usage.inputTokens ??
      usage.promptTokenCount ??
      usage.prompt_tokens;
    const output =
      usage.output_tokens ??
      usage.outputTokens ??
      usage.candidatesTokenCount ??
      usage.completion_tokens;
    const total =
      usage.total_tokens ??
      usage.totalTokens ??
      usage.totalTokenCount;

    const usageDetails = Object.fromEntries(
      Object.entries({
        input,
        output,
        total,
      }).filter(([, value]) => typeof value === "number"),
    );

    return Object.keys(usageDetails).length > 0 ? usageDetails : null;
  }
}
