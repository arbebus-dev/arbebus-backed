let currentLang: "lt" | "en" = "lt";

const translations = {
  lt: {
    travel: "Keliauti",
    account: "Paskyra",
    from: "Iš kur",
    to: "Į kur",
    when: "Kada",
  },
  en: {
    travel: "Travel",
    account: "Account",
    from: "From",
    to: "To",
    when: "When",
  },
};

export const setLang = (lang: "lt" | "en") => {
  currentLang = lang;
};

export const t = (key: keyof (typeof translations)["lt"]) => {
  return translations[currentLang][key];
};
