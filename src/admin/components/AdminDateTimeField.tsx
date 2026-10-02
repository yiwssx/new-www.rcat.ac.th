import { useId, useRef, useState } from "react";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

const LOCAL_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

interface LocalDateTimeParts {
  date: string;
  hour: string;
  minute: string;
}

interface DateDraft {
  sourceDate: string;
  text: string;
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

function formatIsoDateForDisplay(value: string) {
  const match = ISO_DATE_PATTERN.exec(value);

  if (!match) {
    return "";
  }

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function parseDisplayDate(value: string) {
  const match = DISPLAY_DATE_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
  const fieldId = useId();
  const nativeDateInputRef = useRef<HTMLInputElement | null>(null);
  const current = parseLocalDateTime(value);
  const minimum = parseLocalDateTime(min);
  const date = current?.date ?? "";
  const hour = current?.hour ?? "00";
  const minute = current?.minute ?? "00";
  const [dateDraft, setDateDraft] = useState<DateDraft | null>(null);
  const dateText = dateDraft?.sourceDate === date ? dateDraft.text : formatIsoDateForDisplay(date);

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

  function handleDateTextChange(nextText: string) {
    setDateDraft({ sourceDate: date, text: nextText });

    if (!nextText.trim()) {
      commit("", hour, minute);
      return;
    }

    const nextDate = parseDisplayDate(nextText);
    if (nextDate) {
      commit(nextDate, hour, minute);
    }
  }

  function handleDateTextBlur() {
    if (!dateText.trim()) {
      setDateDraft(null);
      return;
    }

    const parsed = parseDisplayDate(dateText);
    if (parsed) {
      commit(parsed, hour, minute);
    }

    setDateDraft(null);
  }

  function openNativeDatePicker() {
    const input = nativeDateInputRef.current;
    if (!input || disabled) {
      return;
    }

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        input.click();
        return;
      }
    }

    input.click();
  }

  function handleNativeDateChange(nextDate: string) {
    setDateDraft(null);
    commit(nextDate, hour, minute);
  }

  const hourLabelId = `${fieldId}-hour-label`;
  const hourSelectId = `${fieldId}-hour`;
  const minuteLabelId = `${fieldId}-minute-label`;
  const minuteSelectId = `${fieldId}-minute`;

  return (
    <Stack spacing={1}>
      <TextField
        label={`${label} - วันที่ (วัน/เดือน/ปี)`}
        type="text"
        value={dateText}
        onChange={(event) => handleDateTextChange(event.target.value)}
        onBlur={handleDateTextBlur}
        placeholder="DD/MM/YYYY"
        disabled={disabled}
        required={required}
        error={error}
        slotProps={{
          inputLabel: { shrink: true },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={`เลือก${label}จากปฏิทิน`}
                  edge="end"
                  onClick={openNativeDatePicker}
                  disabled={disabled}
                >
                  <CalendarMonthOutlinedIcon />
                </IconButton>
              </InputAdornment>
            )
          },
          htmlInput: {
            inputMode: "numeric",
            pattern: "[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}",
            maxLength: 10
          }
        }}
        fullWidth
      />
      <input
        ref={nativeDateInputRef}
        type="date"
        value={date}
        min={minimum?.date}
        onChange={(event) => handleNativeDateChange(event.target.value)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none"
        }}
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <FormControl fullWidth size="small" disabled={disabled || !date} error={error}>
          <InputLabel id={hourLabelId}>ชั่วโมง (00–23)</InputLabel>
          <Select
            id={hourSelectId}
            labelId={hourLabelId}
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
          <InputLabel id={minuteLabelId}>นาที (00–59)</InputLabel>
          <Select
            id={minuteSelectId}
            labelId={minuteLabelId}
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
