export const TOXIC_TERMS = [
  "ngu",
  "dốt",
  "đần",
  "đần độn",
  "đồ ngu",
  "óc chó",
  "súc vật",
  "câm mồm",
  "im mồm",
  "cút",
  "biến đi",
  "khốn nạn",
  "mất dạy",
  "vô học",
  "đéo",
  "đếch",
  "địt",
  "đụ",
  "dm",
  "đm",
  "dmm",
  "đmm",
  "vcl",
  "vl",
  "cc",
  "cặc",
  "lồn",
  "loz",
  "mẹ mày",
  "bố mày",
  "chó má",
  "đĩ",
  "phò",
  "điên",
  "tâm thần",
  "bại não",
];

function normalizeForMatch(value: string) {
  return value.toLowerCase().normalize("NFC");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findToxicTerms(text: string) {
  const normalizedText = normalizeForMatch(text || "");

  return TOXIC_TERMS.filter((term) => {
    const normalizedTerm = normalizeForMatch(term);
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegExp(normalizedTerm)}(?=$|[^\\p{L}\\p{N}])`,
      "u",
    );
    return pattern.test(normalizedText);
  });
}
