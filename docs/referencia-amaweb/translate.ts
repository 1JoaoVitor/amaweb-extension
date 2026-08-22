import translations from "../../extension/translations.json";

type TranslationKey = string;
type TranslationParams = Record<string, string | number>;

/**
 * Navega no objeto de traduções usando uma chave com pontos
 * Ex: "RESULTS.summary.score" -> translations.RESULTS.summary.score
 */
function getNestedTranslation(key: string): string | undefined {
  const keys = key.split(".");
  let current: any = translations;

  for (const k of keys) {
    if (current[k] === undefined) {
      return undefined;
    }
    current = current[k];
  }

  return typeof current === "string" ? current : undefined;
}

/**
 * Função principal de tradução
 *
 * @param key - Chave da tradução (ex: "HOME_PAGE.title")
 * @param params - Parâmetros para interpolação (ex: { value: 5 })
 * @returns Texto traduzido
 *
 * @example
 * translate("HOME_PAGE.title") // "Avaliador AMAWeb"
 * translate("TESTS_RESULTS.img_01b.p", { value: 3 }) // "Encontrei 3 imagens..."
 */
export function translate(
  key: TranslationKey,
  params?: TranslationParams
): string {
  let text = getNestedTranslation(key);

  if (!text) {
    return key; // Retorna a chave se não encontrar tradução
  }

  // Substitui parâmetros interpolados
  if (params) {
    Object.keys(params).forEach((param) => {
      const regex = new RegExp(`{{${param}}}`, "g");
      text = text!.replace(regex, String(params[param]));
    });
  }

  return text;
}

/**
 * Função para traduzir múltiplas chaves de uma vez
 * Útil quando você precisa de várias traduções
 *
 * @example
 * translateMultiple(["HOME_PAGE.title", "HOME_PAGE.submit"])
 * // { "HOME_PAGE.title": "Avaliador AMAWeb", "HOME_PAGE.submit": "Avaliar" }
 */
export function translateMultiple(keys: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  keys.forEach((key) => {
    result[key] = translate(key);
  });

  return result;
}

/**
 * Helper para traduzir resultados de testes
 * Automaticamente escolhe singular ou plural
 */
export function translateTestResult(
  testKey: string,
  value: number | string
): string {
  const numValue = typeof value === "number" ? value : parseInt(value);
  const suffix = numValue === 1 ? ".s" : ".p";

  return translate(`TESTS_RESULTS.${testKey}${suffix}`, { value });
}

// Export tipo para autocompletar
export type { TranslationKey, TranslationParams };
