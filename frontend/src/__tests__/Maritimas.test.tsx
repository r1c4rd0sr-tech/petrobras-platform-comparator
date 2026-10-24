import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "../App";
import { fetchPlatforms } from "../api";

vi.mock("../api", () => ({
  fetchPlatforms: vi.fn(),
}));

const mockPlatforms = [
  { id: 1, name: "P-77", status: "operational", unit_type: "FPSO", basin: "Bacia de Campos", field: "Marlim Sul", operator: "Petrobras", oil_bpd: 100000, gas_mmd: 2.0, boed: 115000, year: 2005, accommodation: 100, storage_m3: 100000, length_m: 300, weight_t: 50000, distance_to_coast_km: 100, latitude: -25, longitude: -42, water_depth_m: 1000 },
  { id: 2, name: "P-78", status: "operational", unit_type: "FPSO", basin: "Bacia de Santos", field: "Búzios", operator: "Petrobras", oil_bpd: 150000, gas_mmd: 3.0, boed: 170000, year: 2023, accommodation: 150, storage_m3: 150000, length_m: 350, weight_t: 60000, distance_to_coast_km: 150, latitude: -26, longitude: -43, water_depth_m: 2000 },
  { id: 3, name: "P-79", status: "construction", unit_type: "FPSO", basin: "Bacia de Santos", field: "Búzios", operator: "Petrobras", oil_bpd: 0, gas_mmd: 0, boed: 0, year: 2025, accommodation: 0, storage_m3: 0, length_m: 0, weight_t: 0, distance_to_coast_km: 0, latitude: -27, longitude: -44, water_depth_m: 2000 },
];

describe("Seção 1 — Plataformas Marítimas", () => {
  beforeEach(() => {
    vi.mocked(fetchPlatforms).mockResolvedValue(mockPlatforms as any);
    localStorage.clear();
  });

  it("deve exibir 3 plataformas na Seção 1 (mock)", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
  });

  it("deve filtrar por bacia", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
    const baciaSelect = screen.getByLabelText("Bacia");
    fireEvent.change(baciaSelect, { target: { value: "Bacia de Santos" } });
    await waitFor(() => {
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });
  });

  it("deve filtrar por campo", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
    const campoSelect = screen.getByLabelText("Campo");
    fireEvent.change(campoSelect, { target: { value: "Búzios" } });
    await waitFor(() => {
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });
  });

  it("deve filtrar por operador", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
    const operadorSelect = screen.getByLabelText("Operador");
    fireEvent.change(operadorSelect, { target: { value: "Petrobras" } });
    await waitFor(() => {
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
  });

  it("deve filtrar por óleo mínimo", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
    const oleoInput = screen.getByLabelText("Óleo mín. (bpd)");
    fireEvent.change(oleoInput, { target: { value: "100000" } });
    await waitFor(() => {
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });
  });

  it("deve filtrar por gás mínimo", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
    const gasInput = screen.getByLabelText("Gás mín. (MMm³/d)");
    fireEvent.change(gasInput, { target: { value: "2" } });
    await waitFor(() => {
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });
  });

  it("deve filtrar por ano mínimo", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
    const anoInput = screen.getByLabelText("Ano mín.");
    fireEvent.change(anoInput, { target: { value: "2020" } });
    await waitFor(() => {
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });
  });

  it("deve filtrar por acomodação mínima", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
    const acomodacaoInput = screen.getByLabelText("Acomodação mín.");
    fireEvent.change(acomodacaoInput, { target: { value: "100" } });
    await waitFor(() => {
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
    });
  });

  it("deve permitir selecionar até 10 plataformas", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
    const selectButtons = screen.getAllByRole("button", { name: "Selecionar para comparativo" });
    for (let i = 0; i < Math.min(3, selectButtons.length); i++) {
      fireEvent.click(selectButtons[i]);
    }
    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 3/10")).toBeInTheDocument();
    });
  });

  it("deve ordenar por óleo (decrescente)", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
    });
    const sortSelect = screen.getByLabelText("Ordenar por");
    fireEvent.change(sortSelect, { target: { value: "oil" } });
    await waitFor(() => {
      const cards = screen.getAllByRole("heading", { level: 4 });
      expect(cards[0]).toHaveTextContent("P-78");
    });
  });
});
