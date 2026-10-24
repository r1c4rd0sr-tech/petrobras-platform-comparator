import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "../App";
import refinariasData from "../data/refinarias.json";
import terminaisArmazenamentoData from "../data/terminais-armazenamento.json";
import utgnsGasData from "../data/utgns-gas.json";
import ecompsGasbolData from "../data/ecomps-gasbol.json";

vi.mock("../api", () => ({
  fetchPlatforms: vi.fn().mockResolvedValue([]),
}));

const totalRefino = refinariasData.length + terminaisArmazenamentoData.length + utgnsGasData.length + ecompsGasbolData.length;

describe("Seção 3 — Refino, Gás e Logística", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("deve exibir 53 unidades na Seção 3 (12 refinarias + 19 terminais + 1 UTGCAB + 8 UTGNs + 13 ECOMPs)", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Refino, Gás e Logística" }));
    await waitFor(() => {
      expect(screen.getByText(/\(53\)/)).toBeInTheDocument();
    });
    expect(totalRefino).toBe(53);
  });

  it("deve conter 12 refinarias, 19 terminais, 1 UTGCAB, 8 UTGNs e 13 ECOMPs", () => {
    const refinarias = refinariasData.filter((u: any) => u.unit_type === "Refinaria");
    const terminais = [...refinariasData, ...terminaisArmazenamentoData].filter((u: any) => u.unit_type === "Terminal");
    const utgcab = refinariasData.filter((u: any) => u.unit_type === "Unidade de Tratamento de Gás");
    const utgns = utgnsGasData.filter((u: any) => u.unit_type === "Unidade de Tratamento de Gás");
    const ecomps = ecompsGasbolData.filter((u: any) => u.unit_type === "Estação de Compressão");
    expect(refinarias.length).toBe(12);
    expect(terminais.length).toBe(19);
    expect(utgcab.length).toBe(1);
    expect(utgns.length).toBe(8);
    expect(ecomps.length).toBe(13);
  });

  it("deve filtrar por estado na Seção 3", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Refino, Gás e Logística" }));
    await waitFor(() => {
      expect(screen.getByText(/\(53\)/)).toBeInTheDocument();
    });
    const estadoSelect = screen.getByLabelText("Estado");
    fireEvent.change(estadoSelect, { target: { value: "RJ" } });
    await waitFor(() => {
      const rjUnits = [...refinariasData, ...terminaisArmazenamentoData, ...utgnsGasData, ...ecompsGasbolData].filter((u: any) => u.state === "RJ");
      expect(screen.getByText(new RegExp(`\\(${rjUnits.length}\\)`))).toBeInTheDocument();
    });
  });

  it("deve filtrar por gás mínimo na Seção 3", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Refino, Gás e Logística" }));
    await waitFor(() => {
      expect(screen.getByText(/\(53\)/)).toBeInTheDocument();
    });
    const gasInput = screen.getByLabelText("Gás mín. (MMm³/d)");
    fireEvent.change(gasInput, { target: { value: "10" } });
    await waitFor(() => {
      const gasUnits = [...refinariasData, ...terminaisArmazenamentoData, ...utgnsGasData, ...ecompsGasbolData].filter((u: any) => (u.gas_mmd ?? 0) >= 10);
      expect(screen.getByText(new RegExp(`\\(${gasUnits.length}\\)`))).toBeInTheDocument();
    });
  });

  it("deve filtrar por armazenamento mínimo na Seção 3", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Refino, Gás e Logística" }));
    await waitFor(() => {
      expect(screen.getByText(/\(53\)/)).toBeInTheDocument();
    });
    const storageInput = screen.getByLabelText("Armazenamento mín. (m³)");
    fireEvent.change(storageInput, { target: { value: "100000" } });
    await waitFor(() => {
      const storageUnits = [...refinariasData, ...terminaisArmazenamentoData, ...utgnsGasData, ...ecompsGasbolData].filter((u: any) => (u.storage_m3 ?? 0) >= 100000);
      expect(screen.getByText(new RegExp(`\\(${storageUnits.length}\\)`))).toBeInTheDocument();
    });
  });

  it("deve permitir selecionar até 10 unidades na Seção 3", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Refino, Gás e Logística" }));
    await waitFor(() => {
      expect(screen.getByText(/\(53\)/)).toBeInTheDocument();
    });
    const selectButtons = screen.getAllByRole("button", { name: "Selecionar para comparativo" });
    for (let i = 0; i < 10; i++) {
      fireEvent.click(selectButtons[i]);
    }
    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 10/10")).toBeInTheDocument();
    });
  });

  it("deve exibir a UTGCAB de Cabiúnas com capacidade de 24,6 MMm³/dia", () => {
    const cabiunas = refinariasData.find((u: any) => u.id === 2017);
    expect(cabiunas).toBeDefined();
    expect(cabiunas?.name).toContain("Cabiúnas");
    expect(cabiunas?.gas_mmd).toBe(24.6);
  });

  it("deve conter 8 UTGNs com capacidade total de ~66,2 MMm³/dia", () => {
    const totalGas = utgnsGasData.reduce((sum, u: any) => sum + (u.gas_mmd ?? 0), 0);
    expect(utgnsGasData.length).toBe(8);
    expect(totalGas).toBeCloseTo(66.2, 1);
  });

  it("deve conter 13 ECOMPs com vazão nominal de 8,00 ou 30,08 MMm³/dia", () => {
    const flows = ecompsGasbolData.map((u: any) => u.gas_mmd);
    expect(ecompsGasbolData.length).toBe(13);
    flows.forEach((flow) => {
      expect([8.0, 30.08]).toContain(flow);
    });
  });

  it("não deve ter IDs duplicados na Seção 3", () => {
    const allIds = [...refinariasData, ...terminaisArmazenamentoData, ...utgnsGasData, ...ecompsGasbolData].map((u: any) => u.id);
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});
