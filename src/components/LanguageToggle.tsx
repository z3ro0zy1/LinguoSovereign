"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOCALE_LABELS } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, toggleLocale, t } = useLocale();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggleLocale}
      className={`rounded-full border-white/70 bg-white/85 backdrop-blur-md ${className}`.trim()}
      title={t("language")}
      aria-label={t("language")}
    >
      <Languages className="mr-2 h-4 w-4" />
      {LOCALE_LABELS[locale]}
    </Button>
  );
}
