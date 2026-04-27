import { ReactNode, createContext, useContext } from "react";

export type Language = "th" | "en";
const fixedLanguage: Language = "th";

interface LanguageContextValue {
  language: Language;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const languageContextValue: LanguageContextValue = { language: fixedLanguage };

export function LanguageProvider({ children }: { children: ReactNode }) {
  return <LanguageContext.Provider value={languageContextValue}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider.");
  }

  return context;
}
