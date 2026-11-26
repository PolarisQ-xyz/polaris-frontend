import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChgCell } from "./page";

describe("ChgCell", () => {
  it("renders a dash when there is no history (null)", () => {
    render(<ChgCell yesBpsChange={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a visibly nonzero value for sub-1% moves", () => {
    render(<ChgCell yesBpsChange={40} />);
    const cell = screen.getByText(/\+0\.4%/);
    expect(cell).toBeInTheDocument();
    expect(cell.textContent).not.toBe("+0%");
  });

  it("renders an integer percentage for moves of 1% or more", () => {
    render(<ChgCell yesBpsChange={250} />);
    expect(screen.getByText("+3%")).toBeInTheDocument();
  });
});
