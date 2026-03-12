export type GpuCategory = {
  section: string;
  productFamily: string;
  sectionOrder: number;
  familyOrder: number;
  modelOrder: number;
};

const SECTION_ORDER: Record<string, number> = {
  nvidia: 0,
  amd: 1,
};

function normalizeForMatch(gpuType: string): string {
  return gpuType
    .trim()
    .toUpperCase()
    .replace(/^NVIDIA\s+/i, "")
    .trim();
}

export function getGpuCategory(gpuType: string): GpuCategory {
  const s = gpuType.trim();
  const n = normalizeForMatch(s);

  if (n.includes("MI300") || n.includes("MI350") || n.includes("MI250") || n.startsWith("MI")) {
    const modelOrder = n.includes("MI300X") ? 0 : n.includes("MI300") ? 1 : n.includes("MI250") ? 2 : 10;
    return {
      section: "AMD",
      productFamily: "Instinct MI series",
      sectionOrder: SECTION_ORDER.amd,
      familyOrder: 0,
      modelOrder,
    };
  }

  if (n.includes("B200") || n.includes("B100")) {
    const modelOrder = n.includes("B200") ? 0 : 1;
    return {
      section: "NVIDIA",
      productFamily: "B-series (Blackwell)",
      sectionOrder: SECTION_ORDER.nvidia,
      familyOrder: 0,
      modelOrder,
    };
  }

  if (n.includes("H200") || n.includes("H100")) {
    const modelOrder = n.includes("H200")
      ? n.includes("NVL") ? 0 : 1
      : n.includes("SXM") ? 2 : n.includes("PCIe") ? 3 : 4;
    return {
      section: "NVIDIA",
      productFamily: "H-series (Hopper)",
      sectionOrder: SECTION_ORDER.nvidia,
      familyOrder: 1,
      modelOrder,
    };
  }

  if (/RTX\s*50\d{2}|RTX\s*5090/i.test(s) || (n.includes("RTX") && /40\d{2}|4090|4080/i.test(s))) {
    const modelOrder = n.includes("5090") ? 0 : n.includes("4090") ? 1 : n.includes("4080") ? 2 : 5;
    return {
      section: "NVIDIA",
      productFamily: "GeForce RTX (Consumer)",
      sectionOrder: SECTION_ORDER.nvidia,
      familyOrder: 2,
      modelOrder,
    };
  }

  if (n.includes("L40S") || n.includes("L40") || /\bL4\b/.test(n)) {
    const modelOrder = n.includes("L40S") ? 0 : n.includes("L40") ? 1 : 2;
    return {
      section: "NVIDIA",
      productFamily: "L-series (Inference)",
      sectionOrder: SECTION_ORDER.nvidia,
      familyOrder: 3,
      modelOrder,
    };
  }

  if (
    n.includes("RTX") &&
    (n.includes("6000") || n.includes("4500") || n.includes("4000") || n.includes("2000")) &&
    (n.includes("ADA") || n.includes("PRO") || /RTX\s*(PRO\s*)?(4500|4000|2000)/i.test(s))
  ) {
    const modelOrder = n.includes("6000") ? 0 : n.includes("4500") ? 1 : n.includes("4000") ? 2 : 3;
    return {
      section: "NVIDIA",
      productFamily: "RTX Professional (Ada)",
      sectionOrder: SECTION_ORDER.nvidia,
      familyOrder: 4,
      modelOrder,
    };
  }

  if (n.includes("A40")) {
    return {
      section: "NVIDIA",
      productFamily: "A40 (Professional)",
      sectionOrder: SECTION_ORDER.nvidia,
      familyOrder: 5,
      modelOrder: 0,
    };
  }

  if (n.includes("A100")) {
    const modelOrder = n.includes("SXM") ? 0 : n.includes("PCIe") ? 1 : n.includes("NVL") ? 2 : 3;
    return {
      section: "NVIDIA",
      productFamily: "A100 series",
      sectionOrder: SECTION_ORDER.nvidia,
      familyOrder: 6,
      modelOrder,
    };
  }

  if (n.includes("RTX") && (n.includes("3090") || n.includes("3080"))) {
    const modelOrder = n.includes("3090") ? 0 : 1;
    return {
      section: "NVIDIA",
      productFamily: "GeForce RTX (Consumer)",
      sectionOrder: SECTION_ORDER.nvidia,
      familyOrder: 7,
      modelOrder,
    };
  }

  if (n.includes("A6000") || n.includes("A5000") || n.includes("A4500") || n.includes("A4000")) {
    const modelOrder = n.includes("A6000") ? 0 : n.includes("A5000") ? 1 : n.includes("A4500") ? 2 : 3;
    return {
      section: "NVIDIA",
      productFamily: "RTX Professional (Ampere)",
      sectionOrder: SECTION_ORDER.nvidia,
      familyOrder: 8,
      modelOrder,
    };
  }

  if (n.includes("V100") || n.includes("T4")) {
    const modelOrder = n.includes("V100") ? 0 : 1;
    return {
      section: "NVIDIA",
      productFamily: "Legacy (V100, T4)",
      sectionOrder: SECTION_ORDER.nvidia,
      familyOrder: 9,
      modelOrder,
    };
  }

  if (n.includes("RTX") || n.includes("GTX")) {
    return {
      section: "NVIDIA",
      productFamily: "Other",
      sectionOrder: SECTION_ORDER.nvidia,
      familyOrder: 99,
      modelOrder: 100,
    };
  }

  return {
    section: "Other",
    productFamily: s || "Uncategorized",
    sectionOrder: 999,
    familyOrder: 999,
    modelOrder: 999,
  };
}

const PRODUCT_DOC_URLS: Record<string, string> = {
  "NVIDIA::B-series (Blackwell)": "https://www.nvidia.com/en-us/data-center/technologies/blackwell-architecture/",
  "NVIDIA::H-series (Hopper)": "https://www.nvidia.com/en-us/data-center/technologies/hopper-architecture/",
  "NVIDIA::GeForce RTX (Consumer)": "https://www.nvidia.com/en-us/geforce/graphics-cards/",
  "NVIDIA::L-series (Inference)": "https://www.nvidia.com/en-us/data-center/l4/",
  "NVIDIA::RTX Professional (Ada)": "https://www.nvidia.com/en-us/design-visualization/desktop-graphics/",
  "NVIDIA::A40 (Professional)": "https://www.nvidia.com/en-us/design-visualization/quadro/",
  "NVIDIA::A100 series": "https://www.nvidia.com/en-us/data-center/a100/",
  "NVIDIA::RTX Professional (Ampere)": "https://www.nvidia.com/en-us/design-visualization/quadro/",
  "NVIDIA::Legacy (V100, T4)": "https://www.nvidia.com/en-us/data-center/",
  "AMD::Instinct MI series": "https://www.amd.com/en/products/accelerators/instinct.html",
};

const SECTION_FALLBACK_URLS: Record<string, string> = {
  NVIDIA: "https://www.nvidia.com/en-us/",
  AMD: "https://www.amd.com/en/",
};

export function getProductDocUrl(section: string, productFamily: string): string | null {
  return PRODUCT_DOC_URLS[`${section}::${productFamily}`] ?? SECTION_FALLBACK_URLS[section] ?? null;
}

export function displayGpuName(gpuType: string): string {
  const s = gpuType.trim();
  if (s.startsWith("NVIDIA ")) return s.slice(7).trim();
  if (s.startsWith("AMD ")) return s.slice(4).trim();
  return s;
}

/** @deprecated Use getGpuCategory */
export function getGpuFamily(gpuType: string): string {
  const cat = getGpuCategory(gpuType);
  return `${cat.section} › ${cat.productFamily}`;
}

/** @deprecated Use getGpuCategory */
export function getFamilySortOrder(family: string): number {
  const [section, productFamily] = family.split(" › ");
  const sectionOrder = section ? SECTION_ORDER[section.toLowerCase().replace(/\s/g, "-")] ?? 100 : 100;
  return sectionOrder;
}
