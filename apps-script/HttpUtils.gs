function getResource(event) {
  return String((event && event.resource) || (event && event.parameter && event.parameter.resource) || "").trim();
}

function parsePayload(event) {
  if (event && event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)) {
    return event.payload;
  }

  if (!event || !event.postData || !event.postData.contents) {
    return {};
  }

  try {
    const parsed = JSON.parse(event.postData.contents);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    throw createHttpError("Request body must be valid JSON.", 400);
  }
}

function validateRequired(value, keys) {
  keys.forEach((key) => {
    if (!value || !value[key]) {
      throw createHttpError(`Missing required field: ${key}`, 400);
    }
  });
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
