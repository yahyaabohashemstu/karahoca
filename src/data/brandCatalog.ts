import type { TFunction } from "i18next";
import { apiFetch } from "../utils/apiFetch";
import { readPrerenderData } from "../utils/prerenderData";
import type { SupportedLanguageCode } from "../utils/language";
import type { MarketplaceProductLinks } from "../constants/marketplaces";

export interface BrandProductDetails {
  weight?: string;
  material?: string;
  package?: string;
  count?: string;
  gift?: string;
  weightCountTable?: Array<{ weight: string; count: number }>;
}

export interface BrandProductInfo {
  /**
   * DB product ID (`aylux-liquid-soap1`) — language-independent and unique.
   * The static catalog below carries the SAME ids as the database, so a
   * product keeps one identity when the API response replaces the static
   * fallback: React keys, the `#hash` deep link and wishlist entries all
   * use it. Several products share a display name (size / formula variants
   * such as the 3 L and 400 ML liquid soaps), so names are never identity.
   */
  id?: string;
  name: string;
  description: string;
  image: string;
  alt: string;
  details?: BrandProductDetails;
  /** Optional gallery of additional images (e.g. colour variants) */
  gallery?: string[];
  /** Per-product image scale (0.3–1.5), controls size inside card */
  imageScale?: number;
  /** The product's own Trendyol / Hepsiburada listings (API only). */
  marketplaceLinks?: MarketplaceProductLinks;
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
  // i18next plural forms: "12 pieces", "4 штуки", "12 штук", "4 قطع".
  const pieceCount = (n: number) => t("materials.pieceCount", { count: n });

  return [
    {
      title: t("diox.categories.homeCleaning"),
      products: [
        {
          id: "diox-general-cleaner",
          name: t("diox.products.home.generalCleaner.name"),
          description: t("diox.products.home.generalCleaner.description"),
          image: "/diox-images/ديوكس منظف عام.png",
          alt: t("diox.products.home.generalCleaner.alt"),
          details: {
            weight: "750 ML",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-super-gel",
          name: t("diox.products.home.superGel.name"),
          description: t("diox.products.home.superGel.description"),
          image: "/diox-images/ديوكس سوبر جل.png",
          alt: t("diox.products.home.superGel.alt"),
          details: {
            weight: "450 ML / 900 ML",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-floor-fragrance",
          name: t("diox.products.home.floorFragrance.name"),
          description: t("diox.products.home.floorFragrance.description"),
          image: "/diox-images/ديوكس معطر أرضيات.png",
          alt: t("diox.products.home.floorFragrance.alt"),
          details: {
            weight: "600 ML",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-floor-fragrance2",
          name: t("diox.products.home.floorFragrance2.name"),
          description: t("diox.products.home.floorFragrance2.description"),
          image: "/diox-images/ديوكس معطر الأرضيات.png",
          alt: t("diox.products.home.floorFragrance2.alt"),
          details: {
            weight: "600 ML",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-glass-cleaner",
          name: t("diox.products.home.glassCleaner.name"),
          description: t("diox.products.home.glassCleaner.description"),
          image: "/diox-images/ديوكس منظف الزجاج.png",
          alt: t("diox.products.home.glassCleaner.alt"),
          details: {
            weight: "750 ML",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-chlorine",
          name: t("diox.products.home.chlorine.name"),
          description: t("diox.products.home.chlorine.description"),
          image: "/diox-images/ديوكس كلور.png",
          alt: t("diox.products.home.chlorine.alt"),
          details: {
            weight: "900 ML / 5 L",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-oven-cleaner",
          name: t("diox.products.home.ovenCleaner.name"),
          description: t("diox.products.home.ovenCleaner.description"),
          image: "/diox-images/ديوكس منظف الأفران.png",
          alt: t("diox.products.home.ovenCleaner.alt"),
          details: {
            weight: "750 ML",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-flash",
          name: t("diox.products.home.flash.name"),
          description: t("diox.products.home.flash.description"),
          image: "/diox-images/ديوكس فلاش.png",
          alt: t("diox.products.home.flash.alt"),
          details: {
            weight: "900 ML",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-bathroom-cleaner",
          name: t("diox.products.home.bathroomCleaner.name"),
          description: t("diox.products.home.bathroomCleaner.description"),
          image: "/diox-images/ديوكس منظف الحمام.png",
          alt: t("diox.products.home.bathroomCleaner.alt"),
          details: {
            weight: "750 ML",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-dish-gel",
          name: t("diox.products.home.dishGel.name"),
          description: t("diox.products.home.dishGel.description"),
          image: "/diox-images/ديوكس جل غسيل الصحون.png",
          alt: t("diox.products.home.dishGel.alt"),
          details: {
            weight: "1.5 KG",
            material: plasticBottle,
            count: pieceCount(4),
          },
        },
        {
          id: "diox-dish-liquid1",
          name: t("diox.products.home.dishLiquid1.name"),
          description: t("diox.products.home.dishLiquid1.description"),
          image: "/diox-images/ديوكس سائل غسيل الصحون (1).png",
          alt: t("diox.products.home.dishLiquid1.alt"),
          details: {
            weight: "700 ML",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-dish-liquid2",
          name: t("diox.products.home.dishLiquid2.name"),
          description: t("diox.products.home.dishLiquid2.description"),
          image: "/diox-images/ديوكس سائل غسيل الصحون (2).png",
          alt: t("diox.products.home.dishLiquid2.alt"),
          details: {
            weight: "3 L",
            material: plasticBottle,
            count: pieceCount(4),
          },
        },
      ],
    },
    {
      title: t("diox.categories.laundryCleaning"),
      products: [
        {
          id: "diox-auto-powder1",
          name: t("diox.products.laundry.autoPowder1.name"),
          description: t("diox.products.laundry.autoPowder1.description"),
          image: "/diox-images/ديوكس مسحوق غسيل أوتوماتيك (1).png",
          alt: t("diox.products.laundry.autoPowder1.alt"),
          details: {
            weight: "2.5 KG / 4.5 KG",
            material: plasticBag,
            count: pieceCount(4),
          },
        },
        {
          id: "diox-auto-powder2",
          name: t("diox.products.laundry.autoPowder2.name"),
          description: t("diox.products.laundry.autoPowder2.description"),
          image: "/diox-images/ديوكس مسحوق غسيل أوتوماتيك (2).png",
          alt: t("diox.products.laundry.autoPowder2.alt"),
          details: {
            weight: "2.5 KG / 4.5 KG",
            material: plasticBag,
            count: pieceCount(4),
          },
        },
        {
          id: "diox-liquid-detergent",
          name: t("diox.products.laundry.liquidDetergent.name"),
          description: t("diox.products.laundry.liquidDetergent.description"),
          image: "/diox-images/ديوكس سائل غسيل (1).png",
          alt: t("diox.products.laundry.liquidDetergent.alt"),
          details: {
            weight: "900 ML",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-fabric-softener",
          name: t("diox.products.laundry.fabricSoftener.name"),
          description: t("diox.products.laundry.fabricSoftener.description"),
          image: "/diox-images/ديوكس مطري الغسيل.png",
          alt: t("diox.products.laundry.fabricSoftener.alt"),
          details: {
            weight: "900 ML",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-stain-remover",
          name: t("diox.products.laundry.stainRemover.name"),
          description: t("diox.products.laundry.stainRemover.description"),
          image: "/diox-images/ديوكس مزيل البقع.png",
          alt: t("diox.products.laundry.stainRemover.alt"),
          details: {
            weight: "900 ML",
            material: plasticBottle,
            count: pieceCount(12),
          },
        },
        {
          id: "diox-regular-powder",
          name: t("diox.products.laundry.regularPowder.name"),
          description: t("diox.products.laundry.regularPowder.description"),
          image: "/diox-images/ديوكس مسحوق غسيل عادي.png",
          alt: t("diox.products.laundry.regularPowder.alt"),
          details: {
            weight: "150 G / 1.2 KG / 3.5 KG / 9 KG",
            material: plasticBag,
            count: pieceCount(6),
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
            count: pieceCount(6),
          },
          gallery: [
            "/diox-images/web site - diox - 1.2kg photos/web site - diox - 1.2kg - أزرق.png",
            "/diox-images/web site - diox - 1.2kg photos/web site - diox - 1.2kg - زهري.png",
          ],
        },
        {
          id: "diox-auto-powder-3kg",
          name: t("diox.products.laundry.autoPowder3kg.name"),
          description: t("diox.products.laundry.autoPowder3kg.description"),
          image: "/diox-images/ديوكس مسحوق غسيل أوتوماتيك 3 كيلو.png",
          alt: t("diox.products.laundry.autoPowder3kg.alt"),
          details: {
            weight: "3 KG",
            material: plasticBag,
            count: pieceCount(4),
          },
          gallery: [
            "/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - أزرق.png",
            "/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - برتقالي.png",
            "/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - بنفسجي.png",
            "/diox-images/web site - diox - 3kg photos/web site - diox - 3kg - زهري.png",
          ],
        },
        {
          id: "diox-auto-powder-9kg",
          name: t("diox.products.laundry.autoPowder9kg.name"),
          description: t("diox.products.laundry.autoPowder9kg.description"),
          image: "/diox-images/ديوكس مسحوق غسيل أوتوماتيك 9 كيلو.png",
          alt: t("diox.products.laundry.autoPowder9kg.alt"),
          details: {
            weight: "9 KG",
            material: plasticBag,
            count: pieceCount(4),
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
          id: "diox-liquid-soap",
          name: t("diox.products.personal.liquidSoap.name"),
          description: t("diox.products.personal.liquidSoap.description"),
          image: "/diox-images/ديوكس صابون سائل.png",
          alt: t("diox.products.personal.liquidSoap.alt"),
          details: {
            weight: "400 ML / 3 L",
            material: plasticBottle,
            count: pieceCount(12),
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
        id: "aylux-general-cleaner",
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
        id: "aylux-air-freshener",
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
        id: "aylux-super-gel",
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
        id: "aylux-floor-fragrance",
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
        id: "aylux-glass-cleaner",
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
        id: "aylux-chlorine",
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
        id: "aylux-oven-cleaner",
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
        id: "aylux-flash",
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
        id: "aylux-bathroom-cleaner",
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
        id: "aylux-dish-gel",
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
        id: "aylux-dish-liquid2",
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
        id: "aylux-auto-powder1",
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
        id: "aylux-liquid-detergent",
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
        id: "aylux-fabric-softener",
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
        id: "aylux-stain-remover",
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
        id: "aylux-regular-powder",
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
        id: "aylux-liquid-soap1",
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
        id: "aylux-liquid-soap2",
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
    gift?: string;
  };
  gallery?: string[];
  weightCountTable?: Array<{ weight: string; count: number }>;
  imageScale?: number;
  marketplaceLinks?: MarketplaceProductLinks;
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
      gift: p.details?.gift || undefined,
      weightCountTable: p.weightCountTable || undefined,
    },
    gallery: p.gallery && p.gallery.length > 0 ? p.gallery : undefined,
    imageScale: p.imageScale ?? undefined,
    marketplaceLinks: p.marketplaceLinks,
  })),
});

/**
 * Layer the API catalog over the static fallback.
 *
 * The API is authoritative for WHICH products exist and in WHAT order — the
 * admin panel adds, removes and reorders them — so static entries are
 * matched by product id, never by array position (positions drifted as soon
 * as the first product was added in the admin). Only `gift` is back-filled:
 * the static gift shows when the API record carries none.
 */
export const mergeApiWithStaticCatalog = (
  apiCategories: BrandCategoryData[],
  staticCategories: BrandCategoryData[],
): BrandCategoryData[] => {
  const staticGiftById = new Map<string, string>();
  for (const category of staticCategories) {
    for (const product of category.products) {
      if (product.id && product.details?.gift) staticGiftById.set(product.id, product.details.gift);
    }
  }

  return apiCategories.map((category) => ({
    ...category,
    products: category.products.map((product) => {
      const gift = product.details?.gift ?? (product.id ? staticGiftById.get(product.id) : undefined);
      return gift ? { ...product, details: { ...product.details, gift } } : product;
    }),
  }));
};

/**
 * Static product image → product id, for resolving wishlist entries saved
 * before products carried ids (see contexts/wishlistMigration.ts). Images
 * are language-independent, so the translation function is never needed.
 */
export const getStaticProductIdsByImage = (): Map<string, string> => {
  const identity = ((key: string) => key) as unknown as TFunction;
  const ids = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const { categories } of getBrandCatalogs(identity)) {
    for (const category of categories) {
      for (const product of category.products) {
        if (!product.id) continue;
        if (ids.has(product.image) && ids.get(product.image) !== product.id) ambiguous.add(product.image);
        ids.set(product.image, product.id);
      }
    }
  }
  // An image shared by two products can't tell them apart — never guess.
  for (const image of ambiguous) ids.delete(image);
  return ids;
};

/**
 * Initial catalog for a brand page: the /api/products response embedded in
 * a prerendered page (merged with the static catalog exactly like the live
 * fetch does), else the static catalog. Matching the snapshot here is what
 * lets the browser hydrate it — see utils/prerenderData.ts.
 */
export const initialBrandCategories = (
  brand: "DIOX" | "AYLUX",
  lang: SupportedLanguageCode,
  staticCats: BrandCategoryData[],
): BrandCategoryData[] => {
  const data = readPrerenderData<{ success?: boolean; categories?: PublicApiCategory[] }>(
    `/api/products/${brand}?lang=${lang}`,
  );
  if (!data?.success || !Array.isArray(data.categories) || data.categories.length === 0) return staticCats;
  return mergeApiWithStaticCatalog(data.categories.map(mapPublicCategory), staticCats);
};

export const fetchBrandCatalogFromApi = async (
  brand: "DIOX" | "AYLUX",
  lang: SupportedLanguageCode,
): Promise<BrandCategoryData[] | null> => {
  try {
    const res = await apiFetch(`/api/products/${brand}?lang=${lang}`);
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
