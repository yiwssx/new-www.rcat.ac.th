import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExternalServiceIcon from "../design-system/icons/ExternalServiceIcon";
import type { ExternalServiceIconKey } from "../types";

const iconKeys: ExternalServiceIconKey[] = [
  "apps",
  "calendar",
  "check",
  "groups",
  "handshake",
  "registration",
  "book",
  "school",
  "link"
];

describe("ExternalServiceIcon", () => {
  it("renders every supported E-Service key through the shared Outlined component", () => {
    render(
      <>
        {iconKeys.map((iconKey) => (
          <ExternalServiceIcon key={iconKey} iconKey={iconKey} data-testid={"external-service-" + iconKey} />
        ))}
      </>
    );

    for (const iconKey of iconKeys) {
      const icon = screen.getByTestId("external-service-" + iconKey);
      expect(icon.tagName.toLowerCase()).toBe("svg");
      expect(icon).toHaveAttribute("data-external-service-icon", iconKey);
    }
  });
});
