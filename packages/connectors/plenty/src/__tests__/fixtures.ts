import type { PlentyContact, PlentyOrder, PlentyPagedResponse, PlentyVariation } from "../types/PlentyConfig";

/** Realistic shape of GET /rest/accounts/contacts?with=addresses */
export const contactSearchResponse: PlentyPagedResponse<PlentyContact> = {
  page: 1,
  totalsCount: 2,
  isLastPage: true,
  itemsPerPage: 20,
  entries: [
    {
      id: 118,
      externalId: "K-2024-118",
      number: "118",
      firstName: null,
      lastName: "Bergmann Handels GmbH",
      fullName: "Bergmann Handels GmbH",
      typeId: 1,
      createdAt: "2024-03-11T09:20:00+01:00",
      updatedAt: "2025-11-02T14:05:00+01:00",
      options: [
        { id: 901, typeId: 2, subTypeId: 4, value: "einkauf@bergmann-handel.de", priority: 0 },
        { id: 902, typeId: 1, subTypeId: 1, value: "+49 221 4780-0", priority: 0 },
        { id: 903, typeId: 1, subTypeId: 4, value: "+49 170 1122334", priority: 0 },
      ],
      addresses: [
        {
          id: 301,
          name1: "Bergmann Handels GmbH",
          address1: "Deutzer Freiheit",
          address2: "72",
          postalCode: "50679",
          town: "Köln",
          countryId: 1,
          isDefault: true,
          pivot: { typeId: 1 },
        },
        {
          id: 302,
          name1: "Bergmann Handels GmbH – Lager",
          address1: "Gewerbepark Süd",
          address2: "4a",
          postalCode: "51149",
          town: "Köln",
          countryId: 1,
          isDefault: false,
          pivot: { typeId: 2 },
        },
      ],
    },
    {
      id: 119,
      externalId: null,
      number: "119",
      firstName: "Jana",
      lastName: "Lindner",
      fullName: null,
      typeId: 1,
      createdAt: "2024-05-27T11:40:00+02:00",
      updatedAt: "2025-10-19T08:12:00+02:00",
      options: [{ id: 910, typeId: 2, subTypeId: 4, value: "bestellung@feinkost-lindner.de", priority: 0 }],
      addresses: [],
    },
  ],
};

/** Realistic shape of GET /rest/items/variations?with=item,variationSalesPrices,stock,variationBarcodes */
export const variationSearchResponse: PlentyPagedResponse<PlentyVariation> = {
  page: 1,
  totalsCount: 1,
  isLastPage: true,
  itemsPerPage: 20,
  entries: [
    {
      id: 1101,
      itemId: 210,
      number: "TRK-500-BLK",
      name: "50 L / schwarz",
      externalId: null,
      isActive: true,
      createdAt: "2024-02-01T10:00:00+01:00",
      updatedAt: "2025-12-15T06:00:00+01:00",
      model: "FJ-50-001",
      item: {
        id: 210,
        manufacturerId: 7,
      },
      itemTexts: [
        {
          lang: "de",
          name: "Trekkingrucksack Fjell 50 L",
          previewDescription: "Wasserabweisender Trekkingrucksack mit Alu-Rahmen",
        },
        {
          lang: "en",
          name: "Trekking backpack Fjell 50 L",
        },
      ],
      variationSalesPrices: [
        { variationId: 1101, salesPriceId: 2, price: 89.9, updatedAt: "2025-11-01T00:00:00+01:00" },
        { variationId: 1101, salesPriceId: 1, price: 74.9, updatedAt: "2025-11-01T00:00:00+01:00" },
      ],
      stock: [
        { variationId: 1101, warehouseId: 1, netStock: 142, physicalStock: 150, reservedStock: 8 },
        { variationId: 1101, warehouseId: 2, netStock: 15, physicalStock: 15, reservedStock: 0 },
      ],
      variationBarcodes: [{ barcodeId: 1, code: "4260123456789" }],
    },
  ],
};

/** Realistic shape of POST /rest/orders response */
export const orderCreateResponse: PlentyOrder = {
  id: 5231,
  typeId: 4,
  plentyId: 1000,
  statusId: 3,
  statusName: "Warten auf Freigabe",
  createdAt: "2026-07-21T10:15:00+02:00",
  updatedAt: "2026-07-21T10:15:00+02:00",
  orderItems: [
    {
      id: 9001,
      typeId: 1,
      itemVariationId: 1101,
      quantity: 5,
      orderItemName: "Trekkingrucksack Fjell 50 L schwarz",
      amounts: [{ priceOriginalGross: 89.13, currency: "EUR" }],
    },
  ],
  amounts: [{ isSystemCurrency: true, currency: "EUR", grossTotal: 445.66, netTotal: 374.5 }],
};

/** Realistic Plenty validation error body (422) – field-keyed object. */
export const validationErrorBody = {
  error: { code: 422, message: "The given data was invalid." },
  validation_errors: {
    typeId: ["The type id field is required."],
    plentyId: ["The plenty id field is required."],
    "orderItems.0.itemVariationId": ["The item variation id must be an integer."],
  },
};
