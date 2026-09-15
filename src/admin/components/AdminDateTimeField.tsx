import { FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField } from "@mui/material";

const LOCAL_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;
const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

interface LocalDateTimeParts {
  date: string;
  hour: string;
  minute: string;
}

interface AdminDateTimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  min?: string;
}

function parseLocalDateTime(value?: string): LocalDateTimeParts | null {
  const match = LOCAL_DATE_TIME_PATTERN.exec(String(value || "").trim());

  if (!match) {
    return null;
  }

  return {
    date: match[1],
    hour: match[2],
    minute: match[3]
  };
}

function joinLocalDateTime(parts: LocalDateTimeParts) {
  return `${parts.date}T${parts.hour}:${parts.minute}`;
}

export default function AdminDateTimeField({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  error = false,
  helperText = "",
  min
}: AdminDateTimeFieldProps) {
  const current = parseLocalDateTime(value);
  const minimum = parseLocalDateTime(min);
  const date = current?.date ?? "";
  const hour = current?.hour ?? "00";
  const minute = current?.minute ?? "00";

  function commit(nextDate: string, nextHour: string, nextMinute: string) {
    if (!nextDate) {
      onChange("");
      return;
    }

    let nextValue = joinLocalDateTime({ date: nextDate, hour: nextHour, minute: nextMinute });
    const minimumValue = minimum ? joinLocalDateTime(minimum) : "";

    if (minimumValue && nextValue < minimumValue) {
      nextValue = minimumValue;
    }

    onChange(nextValue);
  }

  return (
    <Stack spacing={1}>
      <TextField
        label={`${label} - วันที่`}
        type="date"
        value={date}
        onChange={(event) => commit(event.target.value, hour, minute)}
        disabled={disabled}
        required={required}
        error={error}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { min: minimum?.date }
        }}
        fullWidth
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <FormControl fullWidth size="small" disabled={disabled || !date} error={error}>
          <InputLabel id={`${label}-hour-label`}>ชั่วโมง (00–23)</InputLabel>
          <Select
            labelId={`${label}-hour-label`}
            label="ชั่วโมง (00–23)"
            value={hour}
            onChange={(event) => commit(date, String(event.target.value), minute)}
          >
            {HOURS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth size="small" disabled={disabled || !date} error={error}>
          <InputLabel id={`${label}-minute-label`}>นาที (00–59)</InputLabel>
          <Select
            labelId={`${label}-minute-label`}
            label="นาที (00–59)"
            value={minute}
            onChange={(event) => commit(date, hour, String(event.target.value))}
          >
            {MINUTES.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      {helperText ? <FormHelperText error={error}>{helperText}</FormHelperText> : null}
    </Stack>
  );
}
