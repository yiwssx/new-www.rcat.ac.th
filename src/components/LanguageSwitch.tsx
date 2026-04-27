import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import { Language } from "../context/LanguageContext";

interface LanguageSwitchProps {
  value: Language;
  onChange: (language: Language) => void;
  color?: "light" | "default";
}

export default function LanguageSwitch({ value, onChange, color = "default" }: LanguageSwitchProps) {
  const isLight = color === "light";

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size="small"
      aria-label="Website language"
      onChange={(_, nextValue: Language | null) => {
        if (nextValue) {
          onChange(nextValue);
        }
      }}
      sx={{
        bgcolor: isLight ? "rgba(255, 255, 255, 0.08)" : "background.paper",
        borderRadius: 1.5,
        "& .MuiToggleButton-root": {
          minWidth: 42,
          px: 1.1,
          py: 0.45,
          borderColor: isLight ? "rgba(255, 255, 255, 0.24)" : "rgba(31, 90, 44, 0.16)",
          color: isLight ? "rgba(255, 255, 255, 0.78)" : "text.secondary",
          fontWeight: 800
        },
        "& .Mui-selected, & .Mui-selected:hover": {
          bgcolor: isLight ? "secondary.main" : "primary.main",
          color: isLight ? "secondary.contrastText" : "primary.contrastText"
        }
      }}
    >
      <ToggleButton value="th" aria-label="Thai language">
        TH
      </ToggleButton>
      <ToggleButton value="en" aria-label="English language">
        EN
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
