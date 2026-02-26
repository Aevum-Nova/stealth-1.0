import { render, screen } from "@testing-library/react";

import SignalFilters from "@/components/signals/SignalFilters";

describe("SignalFilters", () => {
  it("renders filter controls", () => {
    render(
      <SignalFilters
        filters={{ page: 1, limit: 20 }}
        onChange={() => {
          return;
        }}
      />
    );

    expect(screen.getByDisplayValue("All sources")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All statuses")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All sentiment")).toBeInTheDocument();
  });
});
