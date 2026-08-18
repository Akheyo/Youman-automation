import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { API, server } from "./mocks/server";
import { PrefilledTextRenderer } from "@/components/forms/fields/PrefilledTextRenderer";
import type { FieldDefinition } from "@youman/shared";

const FIELD = {
  id: "f-delivery-address",
  key: "deliveryAddress",
  label: "Lieferadresse",
  type: "textarea",
  required: false,
  dynamicSource: {
    endpoint: "/api/v1/search/customers/{customerId}/addresses",
    searchParam: "q",
    valueField: "id",
    labelField: "postalAddress",
    descriptionField: "description",
    minChars: 0,
    debounceMs: 0,
    pageSize: 50,
  },
} as unknown as FieldDefinition;

const option = (id: string, postalAddress: string, description: string) => ({
  id,
  postalAddress,
  description,
  label: postalAddress.replace("\n", ", "),
});

function addressesReturn(items: unknown[]) {
  server.use(
    http.get(`${API}/search/customers/:id/addresses`, () =>
      HttpResponse.json({ items, total: items.length, page: 1, pageSize: items.length, hasMore: false, searchDurationMs: 1 })
    )
  );
}

function Harness({ defaults }: { defaults: Record<string, unknown> }) {
  const methods = useForm({ defaultValues: defaults });
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FormProvider {...methods}>
        <PrefilledTextRenderer field={FIELD} />
        <output data-testid="value">{String(methods.watch("deliveryAddress") ?? "")}</output>
      </FormProvider>
    </QueryClientProvider>
  );
}

const value = () => screen.getByTestId("value").textContent;

describe("PrefilledTextRenderer", () => {
  it("fills the field from the customer's address", async () => {
    addressesReturn([option("302", "Gewerbepark Süd 4a\n51149 Köln", "Lieferadresse (Standard)")]);
    render(<Harness defaults={{ customerId: "118", deliveryAddress: "" }} />);
    await waitFor(() => expect(value()).toBe("Gewerbepark Süd 4a\n51149 Köln"));
  });

  it("keeps an address that came with a reused quote", async () => {
    // Beim Weiterarbeiten an einem Angebot darf die abweichende Anschrift nicht
    // durch die Stammadresse ersetzt werden.
    addressesReturn([option("302", "Gewerbepark Süd 4a\n51149 Köln", "Lieferadresse (Standard)")]);
    render(<Harness defaults={{ customerId: "118", deliveryAddress: "Baustelle Nord\n20095 Hamburg" }} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(value()).toBe("Baustelle Nord\n20095 Hamburg");
  });

  it("does not overwrite what the user typed", async () => {
    addressesReturn([option("302", "Gewerbepark Süd 4a\n51149 Köln", "Lieferadresse (Standard)")]);
    render(<Harness defaults={{ customerId: "118", deliveryAddress: "" }} />);
    await waitFor(() => expect(value()).toContain("Gewerbepark"));

    const box = screen.getByRole("textbox");
    await userEvent.clear(box);
    await userEvent.type(box, "Tor 3");
    await new Promise((r) => setTimeout(r, 50));
    expect(value()).toBe("Tor 3");
  });

  it("offers the other addresses of the customer", async () => {
    addressesReturn([
      option("302", "Gewerbepark Süd 4a\n51149 Köln", "Lieferadresse (Standard)"),
      option("301", "Deutzer Freiheit 72\n50679 Köln", "Rechnungsadresse"),
    ]);
    render(<Harness defaults={{ customerId: "118", deliveryAddress: "" }} />);
    await waitFor(() => expect(value()).toContain("Gewerbepark"));

    await userEvent.selectOptions(screen.getByRole("combobox"), "301");
    expect(value()).toBe("Deutzer Freiheit 72\n50679 Köln");
  });

  it("shows no selector for a single address", async () => {
    addressesReturn([option("302", "Gewerbepark Süd 4a\n51149 Köln", "Lieferadresse (Standard)")]);
    render(<Harness defaults={{ customerId: "118", deliveryAddress: "" }} />);
    await waitFor(() => expect(value()).toContain("Gewerbepark"));
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("stays empty and usable without a customer", async () => {
    render(<Harness defaults={{ customerId: "", deliveryAddress: "" }} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(value()).toBe("");
    expect(screen.getByRole("textbox")).toBeEnabled();
  });
});
