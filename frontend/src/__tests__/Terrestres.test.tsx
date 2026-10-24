import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "../App";
import onshoreData from "../data/onshore.json";

vi.mock("../api", () => ({
  fetchPlatforms: vi.fn().mockResolvedValue([]),
}));

describe("Seção 2 — Campos e Unidades Terrestres", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("deve exibir 10 campos/unidades na Seção 2", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Terrestres" }));
    await waitFor(() => {
      expect(screen.getByText(/\(10\)/)).toBeInTheDocument();
    });
    expect(onshoreData.length).toBe(10);
  });

  it("deve filtrar por bacia", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Terrestres" }));
    await waitFor(() => {
      expect(screen.getByText(/\(10\)/)).toBeInTheDocument();
    });
    const baciaSelect = screen.getByLabelText("Bacia");
    const bacias = [...new Set(onshoreData.map((u: any) => u.basin).filter(Boolean))];
    if (bacias.length > 0) {
      fireEvent.change(baciaSelect, { target: { value: bacias[0] } });
      await waitFor(() => {
        const filtered = onshoreData.filter((u: any) => u.basin === bacias[0]);
        expect(screen.getByText(new RegExp(`\\(${filtered.length}\\)`))).toBeInTheDocument();
      });
    }
  });

  it("deve filtrar por operador", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Terrestres" }));
    await waitFor(() => {
      expect(screen.getByText(/\(10\)/)).toBeInTheDocument();
    });
    const operadorSelect = screen.getByLabelText("Operador");
    fireEvent.change(operadorSelect, { target: { value: "Petrobras" } });
    await waitFor(() => {
      const petrobrasUnits = onshoreData.filter((u: any) => u.operator === "Petrobras");
      expect(screen.getByText(new RegExp(`\\(${petrobrasUnits.length}\\)`))).toBeInTheDocument();
    });
  });

  it("deve filtrar por poços mínimos", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Terrestres" }));
    await waitFor(() => {
      expect(screen.getByText(/\(10\)/)).toBeInTheDocument();
    });
    const pocosInput = screen.getByLabelText("Poços mín.");
    fireEvent.change(pocosInput, { target: { value: "1" } });
    await waitFor(() => {
      const unitsWithWells = onshoreData.filter((u: any) => (u.wells_productive ?? 0) >= 1);
      expect(screen.getByText(new RegExp(`\\(${unitsWithWells.length}\\)`))).toBeInTheDocument();
    });
  });

  it("deve permitir selecionar até 10 campos", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Terrestres" }));
    await waitFor(() => {
      expect(screen.getByText(/\(10\)/)).toBeInTheDocument();
    });
    const selectButtons = screen.getAllByRole("button", { name: "Selecionar para comparativo" });
    for (let i = 0; i < Math.min(10, selectButtons.length); i++) {
      fireEvent.click(selectButtons[i]);
    }
    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 10/10")).toBeInTheDocument();
    });
  });

  it("deve conter o Polo Urucu com produção agregada", () => {
    const urucu = onshoreData.find((u: any) => u.polo === "Polo Urucu");
    expect(urucu).toBeDefined();
    expect(urucu?.producao_polo_gas_mmd).toBeGreaterThan(0);
  });

  it("não deve ter IDs duplicados na Seção 2", () => {
    const allIds = onshoreData.map((u: any) => u.id);
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});
