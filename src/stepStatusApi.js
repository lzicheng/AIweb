const toStateMap = (states) => {
  if (!Array.isArray(states)) return {};

  return states.reduce((result, item) => {
    const stepId = typeof item?.stepId === "string" ? item.stepId.trim() : "";
    if (!stepId) return result;

    result[stepId] = {
      ...item,
      stepId,
    };
    return result;
  }, {});
};

export const fetchStepStatusMap = async ({
  apiUrl,
  fetchImpl = fetch,
  stepIds,
}) => {
  const normalizedStepIds = Array.from(
    new Set(
      (Array.isArray(stepIds) ? stepIds : [])
        .map((stepId) => (typeof stepId === "string" ? stepId.trim() : ""))
        .filter(Boolean),
    ),
  );

  if (!normalizedStepIds.length) return {};

  const isAbsoluteUrl = /^[a-z][a-z\d+\-.]*:/i.test(apiUrl);
  const url = new URL(apiUrl, window.location.origin);
  url.searchParams.set("stepIds", normalizedStepIds.join(","));
  const requestUrl = isAbsoluteUrl ? url.toString() : `${url.pathname}${url.search}`;

  const response = await fetchImpl(requestUrl, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) return {};

  const data = await response.json();
  return toStateMap(data?.states);
};
