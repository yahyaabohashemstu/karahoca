import type { TFunction } from "i18next";
import { buildApiUrl } from "../utils/api";
import type { SupportedLanguageCode } from "../utils/language";

export interface BrandProductDetails {
  weight?: string;
  material?: string;
  package?: string;
  count?: string;
  gift?: string;
  weightCountTable?: Array<{ weight: string; count: number }>;
}

export interface BrandProductInfo {
  /** DB product ID — available when loaded from API; used for deep-link hash */
  id?: string;
  name: string;
  description: string;
  image: string;
  alt: string;
  details?: BrandProductDetails;
  /** Optional gallery of additional images (e.g. colour variants) */
  gallery?: string[];
}

export interface BrandCategoryData {
  title: string;
  products: BrandProductInfo[];
}

export interface BrandCatalogData {
  brand: "DIOX" | "AYLUX";
  categories: BrandCategoryData[];
}

export const getDioxCategories = (t: TFunction): BrandCategoryData[] => {
  const plasticBottle = t("materials.plasticBottle");
  const plasticBag = t("materials.plasticBag");
  const pieces = t("materials.pieces");
  const piecesPlural = t("materials.pieces_plural");

  return [
    {
      title: t("diox.categories.homeCleaning"),
      products: [
        {
          name: t("diox.products.home.generalCleaner.name"),
          description: t("diox.products.home.generalCleaner.description"),
          image: "/diox-images/ديوكس منظف عام.png",
          alt: t("diox.products.home.generalCleaner.alt"),
          details: {
            weight: "750 ML",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.home.superGel.name"),
          description: t("diox.products.home.superGel.description"),
          image: "/diox-images/ديوكس سوبر جل.png",
          alt: t("diox.products.home.superGel.alt"),
          details: {
            weight: "450 ML / 900 ML",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.home.floorFragrance.name"),
          description: t("diox.products.home.floorFragrance.description"),
          image: "/diox-images/ديوكس معطر أرضيات.png",
          alt: t("diox.products.home.floorFragrance.alt"),
          details: {
            weight: "600 ML",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.home.floorFragrance2.name"),
          description: t("diox.products.home.floorFragrance2.description"),
          image: "/diox-images/ديوكس معطر الأرضيات.png",
          alt: t("diox.products.home.floorFragrance2.alt"),
          details: {
            weight: "600 ML",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.home.glassCleaner.name"),
          description: t("diox.products.home.glassCleaner.description"),
          image: "/diox-images/ديوكس منظف الزجاج.png",
          alt: t("diox.products.home.glassCleaner.alt"),
          details: {
            weight: "750 ML",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.home.chlorine.name"),
          description: t("diox.products.home.chlorine.description"),
          image: "/diox-images/ديوكس كلور.png",
          alt: t("diox.products.home.chlorine.alt"),
          details: {
            weight: "900 ML / 5 L",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.home.ovenCleaner.name"),
          description: t("diox.products.home.ovenCleaner.description"),
          image: "/diox-images/ديوكس منظف الأفران.png",
          alt: t("diox.products.home.ovenCleaner.alt"),
          details: {
            weight: "750 ML",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.home.flash.name"),
          description: t("diox.products.home.flash.description"),
          image: "/diox-images/ديوكس فلاش.png",
          alt: t("diox.products.home.flash.alt"),
          details: {
            weight: "900 ML",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.home.bathroomCleaner.name"),
          description: t("diox.products.home.bathroomCleaner.description"),
          image: "/diox-images/ديوكس منظف الحمام.png",
          alt: t("diox.products.home.bathroomCleaner.alt"),
          details: {
            weight: "750 ML",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.home.dishGel.name"),
          description: t("diox.products.home.dishGel.description"),
          image: "/diox-images/ديوكس جل غسيل الصحون.png",
          alt: t("diox.products.home.dishGel.alt"),
          details: {
            weight: "1.5 KG",
            material: plasticBottle,
            count: `4 ${piecesPlural}`,
          },
        },
        {
          name: t("diox.products.home.dishLiquid1.name"),
          description: t("diox.products.home.dishLiquid1.description"),
          image: "/diox-images/ديوكس سائل غسيل الصحون (1).png",
          alt: t("diox.products.home.dishLiquid1.alt"),
          details: {
            weight: "700 ML",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.home.dishLiquid2.name"),
          description: t("diox.products.home.dishLiquid2.description"),
          image: "/diox-images/ديوكس سائل غسيل الصحون (2).png",
          alt: t("diox.products.home.dishLiquid2.alt"),
          details: {
            weight: "3 L",
            material: plasticBottle,
            count: `4 ${piecesPlural}`,
          },
        },
      ],
    },
    {
      title: t("diox.categories.laundryCleaning"),
      products: [
        {
          name: t("diox.products.laundry.autoPowder1.name"),
          description: t("diox.products.laundry.autoPowder1.description"),
          image: "/diox-images/ديوكس مسحوق غسيل أوتوماتيك (1).png",
          alt: t("diox.products.laundry.autoPowder1.alt"),
          details: {
            weight: "2.5 KG / 4.5 KG",
            material: plasticBag,
            count: `4 ${piecesPlural}`,
          },
        },
        {
          name: t("diox.products.laundry.autoPowder2.name"),
          description: t("diox.products.laundry.autoPowder2.description"),
          image: "/diox-images/ديوكس مسحوق غسيل أوتوماتيك (2).png",
          alt: t("diox.products.laundry.autoPowder2.alt"),
          details: {
            weight: "2.5 KG / 4.5 KG",
            material: plasticBag,
            count: `4 ${piecesPlural}`,
          },
        },
        {
          name: t("diox.products.laundry.liquidDetergent.name"),
          description: t("diox.products.laundry.liquidDetergent.description"),
          image: "/diox-images/ديوكس سائل غسيل (1).png",
          alt: t("diox.products.laundry.liquidDetergent.alt"),
          details: {
            weight: "900 ML",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.laundry.fabricSoftener.name"),
          description: t("diox.products.laundry.fabricSoftener.description"),
          image: "/diox-images/ديوكس مطري الغسيل.png",
          alt: t("diox.products.laundry.fabricSoftener.alt"),
          details: {
            weight: "900 ML",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.laundry.stainRemover.name"),
          description: t("diox.products.laundry.stainRemover.description"),
          image: "/diox-images/ديوكس مزيل البقع.png",
          alt: t("diox.products.laundry.stainRemover.alt"),
          details: {
            weight: "900 ML",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
        {
          name: t("diox.products.laundry.regularPowder.name"),
          description: t("diox.products.laundry.regularPowder.description"),
          image: "/diox-images/ديوكس مسحوق غسيل عادي.png",
          alt: t("diox.products.laundry.regularPowder.alt"),
          details: {
            weight: "150 G / 1.2 KG / 3.5 KG / 9 KG",
            material: plasticBag,
            count: `6 ${piecesPlural}`,
          },
        },
        {
          name: t("diox.products.laundry.autoPowder1_2kg.name"),
          description: t("diox.products.laundry.autoPowder1_2kg.description"),
          image: "/diox-images/ديوكس مسحوق غسيل أوتوماتيك 1.2 كيلو.png",
          alt: t("diox.products.laundry.autoPowder1_2kg.alt"),
          details: {
            weight: "1.2 KG",
            material: plasticBag,
            count: `6 ${piecesPlural}`,
          },
          gallery: [
            "/diox-images/web site - diox - 1.2kg photos/web site - diox - 1.2kg - أزرق.png",
            "/diox-images/web site - diox - 1.2kg photos/web site - diox - 1.2kg - زهري.png",
          ],
        },
        {
          name: t("diox.products.laundry.autoPowder3kg.name"),
          description: t("diox.products.laundry.autoPowder3kg.description"),
          image: "/diox-images/ديوكس مسحوق غسيل أوتوماتيك 3 كيلو.png",
          alt: t("diox.products.laundry.autoPowder3kg.alt"),
          details: {
            weight: "3 KG",
            material: plasticBag,
            count: `4 ${piecesPlural}`,
          },
          gallery: [
            "/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - أزرق.png",
            "/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - برتقالي.png",
            "/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - بنفسجي.png",
            "/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - زهري.png",
          ],
        },
        {
          name: t("diox.products.laundry.autoPowder9kg.name"),
          description: t("diox.products.laundry.autoPowder9kg.description"),
          image: "/diox-images/ديوكس مسحوق غسيل أوتوماتيك 9 كيلو.png",
          alt: t("diox.products.laundry.autoPowder9kg.alt"),
          details: {
            weight: "9 KG",
            material: plasticBag,
            count: `4 ${piecesPlural}`,
          },
          gallery: [
            "/diox-images/web site - diox - 9kg photos/web site - diox - 9kg - أزرق.png",
            "/diox-images/web site - diox - 9kg photos/web site - diox - 9kg - برتقالي.png",
            "/diox-images/web site - diox - 9kg photos/web site - diox - 9kg - بنفسجي.png",
            "/diox-images/web site - diox - 9kg photos/web site - diox - 9kg - زهري.png",
          ],
        },
      ],
    },
    {
      title: t("diox.categories.personalHygiene"),
      products: [
        {
          name: t("diox.products.personal.liquidSoap.name"),
          description: t("diox.products.personal.liquidSoap.description"),
          image: "/diox-images/ديوكس صابون سائل.png",
          alt: t("diox.products.personal.liquidSoap.alt"),
          details: {
            weight: "400 ML / 3 L",
            material: plasticBottle,
            count: `12 ${pieces}`,
          },
        },
      ],
    },
  ];
};

export const getAyluxCategories = (t: TFunction): BrandCategoryData[] => [
  {
    title: t("aylux.categories.homeCleaning"),
    products: [
      {
        name: t("aylux.products.home.generalCleaner.name"),
        description: t("aylux.products.home.generalCleaner.description"),
        image: "/aylux-images/آيلوكس منظف عام.png",
        alt: t("aylux.products.home.generalCleaner.alt"),
        details: {
          weight: "750 ML",
          material: t("aylux.products.home.generalCleaner.material"),
          count: t("aylux.products.home.generalCleaner.count"),
        },
      },
      {
        name: t("aylux.products.home.airFreshener.name"),
        description: t("aylux.products.home.airFreshener.description"),
        image: "/aylux-images/آيلوكس معطر الهواء.png",
        alt: t("aylux.products.home.airFreshener.alt"),
        details: {
          weight: "400 ML",
          material: t("aylux.products.home.airFreshener.material"),
          count: t("aylux.products.home.airFreshener.count"),
        },
      },
      {
        name: t("aylux.products.home.superGel.name"),
        description: t("aylux.products.home.superGel.description"),
        image: "/aylux-images/آيلوكس سوبر جل.png",
        alt: t("aylux.products.home.superGel.alt"),
        details: {
          weight: "450 ML / 900 ML",
          material: t("aylux.products.home.superGel.material"),
          count: t("aylux.products.home.superGel.count"),
        },
      },
      {
        name: t("aylux.products.home.floorFragrance.name"),
        description: t("aylux.products.home.floorFragrance.description"),
        image: "/aylux-images/آيلوكس معطر الأرضيات.png",
        alt: t("aylux.products.home.floorFragrance.alt"),
        details: {
          weight: "600 ML",
          material: t("aylux.products.home.floorFragrance.material"),
          count: t("aylux.products.home.floorFragrance.count"),
        },
      },
      {
        name: t("aylux.products.home.glassCleaner.name"),
        description: t("aylux.products.home.glassCleaner.description"),
        image: "/aylux-images/آيلوكس منظف الزجاج.png",
        alt: t("aylux.products.home.glassCleaner.alt"),
        details: {
          weight: "750 ML",
          material: t("aylux.products.home.glassCleaner.material"),
          count: t("aylux.products.home.glassCleaner.count"),
        },
      },
      {
        name: t("aylux.products.home.chlorine.name"),
        description: t("aylux.products.home.chlorine.description"),
        image: "/aylux-images/آيلوكس كلور (مبيض).png",
        alt: t("aylux.products.home.chlorine.alt"),
        details: {
          weight: "900 ML / 5 L",
          material: t("aylux.products.home.chlorine.material"),
          count: t("aylux.products.home.chlorine.count"),
        },
      },
      {
        name: t("aylux.products.home.ovenCleaner.name"),
        description: t("aylux.products.home.ovenCleaner.description"),
        image: "/aylux-images/آيلوكس منظف الفرن.png",
        alt: t("aylux.products.home.ovenCleaner.alt"),
        details: {
          weight: "750 ML",
          material: t("aylux.products.home.ovenCleaner.material"),
          count: t("aylux.products.home.ovenCleaner.count"),
        },
      },
      {
        name: t("aylux.products.home.flash.name"),
        description: t("aylux.products.home.flash.description"),
        image: "/aylux-images/آيلوكس فلاش المنظف.png",
        alt: t("aylux.products.home.flash.alt"),
        details: {
          weight: "900 ML",
          material: t("aylux.products.home.flash.material"),
          count: t("aylux.products.home.flash.count"),
        },
      },
      {
        name: t("aylux.products.home.bathroomCleaner.name"),
        description: t("aylux.products.home.bathroomCleaner.description"),
        image: "/aylux-images/آيلوكس منظف الحمام.png",
        alt: t("aylux.products.home.bathroomCleaner.alt"),
        details: {
          weight: "750 ML",
          material: t("aylux.products.home.bathroomCleaner.material"),
          count: t("aylux.products.home.bathroomCleaner.count"),
        },
      },
      {
        name: t("aylux.products.home.dishGel.name"),
        description: t("aylux.products.home.dishGel.description"),
        image: "/aylux-images/آيلوكس جل غسيل الصحون.png",
        alt: t("aylux.products.home.dishGel.alt"),
        details: {
          weight: "1.5 KG",
          material: t("aylux.products.home.dishGel.material"),
          count: t("aylux.products.home.dishGel.count"),
        },
      },
      {
        name: t("aylux.products.home.dishLiquid2.name"),
        description: t("aylux.products.home.dishLiquid2.description"),
        image: "/aylux-images/آيلوكس سائل غسيل الصحون (2).png",
        alt: t("aylux.products.home.dishLiquid2.alt"),
        details: {
          weight: "3 L",
          material: t("aylux.products.home.dishLiquid2.material"),
          count: t("aylux.products.home.dishLiquid2.count"),
        },
      },
    ],
  },
  {
    title: t("aylux.categories.laundryCleaning"),
    products: [
      {
        name: t("aylux.products.laundry.autoPowder1.name"),
        description: t("aylux.products.laundry.autoPowder1.description"),
        image: "/aylux-images/آيلوكس مسحوق غسيل أوتوماتيك (1).png",
        alt: t("aylux.products.laundry.autoPowder1.alt"),
        details: {
          weight: "150 G / 1.2 KG / 3.5 KG / 9 KG",
          material: t("aylux.products.laundry.autoPowder1.material"),
          count: t("aylux.products.laundry.autoPowder1.count"),
          gift: t("aylux.products.laundry.autoPowder1.gift"),
        },
      },
      {
        name: t("aylux.products.laundry.liquidDetergent.name"),
        description: t("aylux.products.laundry.liquidDetergent.description"),
        image: "/aylux-images/آيلوكس مسحوق الغسيل السائل.png",
        alt: t("aylux.products.laundry.liquidDetergent.alt"),
        details: {
          weight: "900 ML",
          material: t("aylux.products.laundry.liquidDetergent.material"),
          count: t("aylux.products.laundry.liquidDetergent.count"),
        },
      },
      {
        name: t("aylux.products.laundry.fabricSoftener.name"),
        description: t("aylux.products.laundry.fabricSoftener.description"),
        image: "/aylux-images/آيلوكس مطري الغسيل.png",
        alt: t("aylux.products.laundry.fabricSoftener.alt"),
        details: {
          weight: "900 ML",
          material: t("aylux.products.laundry.fabricSoftener.material"),
          count: t("aylux.products.laundry.fabricSoftener.count"),
        },
      },
      {
        name: t("aylux.products.laundry.stainRemover.name"),
        description: t("aylux.products.laundry.stainRemover.description"),
        image: "/aylux-images/آيلوكس مزيل البقع.png",
        alt: t("aylux.products.laundry.stainRemover.alt"),
        details: {
          weight: "900 ML",
          material: t("aylux.products.laundry.stainRemover.material"),
          count: t("aylux.products.laundry.stainRemover.count"),
        },
      },
      {
        name: t("aylux.products.laundry.regularPowder.name"),
        description: t("aylux.products.laundry.regularPowder.description"),
        image: "/aylux-images/آيلوكس مسحوق الغسيل اليدوي.png",
        alt: t("aylux.products.laundry.regularPowder.alt"),
        details: {
          weight: "300 G / 600 G / 3 KG / 5 KG / 9 KG",
          material: t("aylux.products.laundry.regularPowder.material"),
          count: t("aylux.products.laundry.regularPowder.count"),
        },
      },
    ],
  },
  {
    title: t("aylux.categories.personalHygiene"),
    products: [
      {
        name: t("aylux.products.personal.liquidSoap1.name"),
        description: t("aylux.products.personal.liquidSoap1.description"),
        image: "/aylux-images/آيلوكس صابون سائل (1).png",
        alt: t("aylux.products.personal.liquidSoap1.alt"),
        details: {
          weight: "3 L",
          material: t("aylux.products.personal.liquidSoap1.material"),
          count: t("aylux.products.personal.liquidSoap1.count"),
        },
      },
      {
        name: t("aylux.products.personal.liquidSoap2.name"),
        description: t("aylux.products.personal.liquidSoap2.description"),
        image: "/aylux-images/آيلوكس صابون سائل (2).png",
        alt: t("aylux.products.personal.liquidSoap2.alt"),
        details: {
          weight: "400 ML",
          material: t("aylux.products.personal.liquidSoap2.material"),
          count: t("aylux.products.personal.liquidSoap2.count"),
        },
      },
    ],
  },
];

export const getBrandCatalogs = (t: TFunction): BrandCatalogData[] => [
  {
    brand: "DIOX",
    categories: getDioxCategories(t),
  },
  {
    brand: "AYLUX",
    categories: getAyluxCategories(t),
  },
];

// ─── API-based fetching (primary source when server is available) ────────────
// The public API (/api/products/:brand?lang=xx) returns already-translated
// fields: { title, products: [{ name, description, image, alt, details: { weight, material, count } }] }

interface PublicApiProduct {
  id?: string;
  name: string;
  description: string;
  image: string;
  alt: string;
  details?: {
    weight?: string;
    material?: string;
    count?: string;
  };
  gallery?: string[];
  weightCountTable?: Array<{ weight: string; count: number }>;
}

interface PublicApiCategory {
  id?: string;
  key?: string;
  title: string;
  products: PublicApiProduct[];
}

const mapPublicCategory = (cat: PublicApiCategory): BrandCategoryData => ({
  title: cat.title,
  products: cat.products.map((p) => ({
    id: p.id,           // ← pass through for deep-link hash
    name: p.name,
    description: p.description,
    image: p.image,
    alt: p.alt,
    details: {
      weight: p.details?.weight || undefined,
      material: p.details?.material || undefined,
      count: p.details?.count || undefined,
      weightCountTable: p.weightCountTable || undefined,
    },
    gallery: p.gallery && p.gallery.length > 0 ? p.gallery : undefined,
  })),
});

export const fetchBrandCatalogFromApi = async (
  brand: "DIOX" | "AYLUX",
  lang: SupportedLanguageCode,
): Promise<BrandCategoryData[] | null> => {
  try {
    const res = await fetch(buildApiUrl(`/api/products/${brand}?lang=${lang}`));
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success: boolean;
      categories: PublicApiCategory[];
    };
    if (!data.success || !Array.isArray(data.categories)) return null;
    return data.categories.map(mapPublicCategory);
  } catch {
    return null;
  }
};
