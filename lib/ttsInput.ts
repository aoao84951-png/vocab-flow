const normalizeText = (text: string) => {
  return text.replace(/\s+/g, " ").trim();
};

const escapeSsml = (text: string) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
};

const hasEnglishParentheses = (text: string) => {
  return /\(([A-Za-z][A-Za-z\s'-]*)\)/.test(text);
};

const removeEnglishParentheses = (text: string) => {
  return text
    .replace(/\s*\(([A-Za-z][A-Za-z\s'-]*)\)\s*/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
};

const includeEnglishParentheses = (text: string) => {
  return text
    .replace(/\(([A-Za-z][A-Za-z\s'-]*)\)/g, "$1")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
};

export const buildTtsInput = (text: string, voice: string) => {
  const normalized = normalizeText(text);
  const renderSpeech = (value: string) => {
    const escaped = escapeSsml(value);
    if (!voice.startsWith("en-")) return escaped;
    // Replace punctuation instead of adding a break after it, which can double
    // the pause. Preserve grouping commas between digits (e.g. 1,000).
    return escaped.replace(/(?<!\d),\s*|,(?!\d)\s*/g, '<break time="100ms"/> ');
  };
  const singleReading = () => {
    const speech = renderSpeech(normalized);
    return speech === escapeSsml(normalized)
      ? { text: normalized }
      : { ssml: `<speak>${speech}</speak>` };
  };

  if (!hasEnglishParentheses(normalized)) {
    return singleReading();
  }

  const withoutParentheses = removeEnglishParentheses(normalized);
  const withParentheses = includeEnglishParentheses(normalized);

  if (!withoutParentheses || !withParentheses || withoutParentheses === withParentheses) {
    return singleReading();
  }

  return {
    ssml: `<speak><s>${renderSpeech(withoutParentheses)}</s><break time="500ms"/><s>${renderSpeech(withParentheses)}</s></speak>`,
  };
};
