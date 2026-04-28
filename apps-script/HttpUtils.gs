function getResource(event) {
  return (event.parameter && event.parameter.resource) || "snapshot";
}

function getQueryParams(event) {
  return (event && event.parameter) || {};
}

function parsePayload(event) {
  if (!event.postData || !event.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(event.postData.contents);
  } catch (error) {
    throw new Error("Request body must be valid JSON.");
  }
}

function validateRequired(value, keys) {
  keys.forEach((key) => {
    if (!value[key]) {
      throw new Error(`Missing required field: ${key}`);
    }
  });
}

function validateEventDateRange(startDateValue, endDateValue) {
  const startDate = parseEventDateValue(startDateValue, "start date");

  if (!endDateValue) {
    return;
  }

  const endDate = parseEventDateValue(endDateValue, "end date");
  const startDay = formatDateKey(startDate);
  const endDay = formatDateKey(endDate);

  if (endDay < startDay) {
    throw new Error("End date must be the same as or after the start date.");
  }
}

function parseEventDateValue(value, label) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid ${label}.`);
  }

  return parsedDate;
}

function formatDateKey(dateValue) {
  return Utilities.formatDate(dateValue, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function jsonResponse(payload, statusCode) {
  const output = ContentService.createTextOutput(
    JSON.stringify({
      ...payload,
      statusCode: statusCode || 200
    })
  );

  return output.setMimeType(ContentService.MimeType.JSON);
}
