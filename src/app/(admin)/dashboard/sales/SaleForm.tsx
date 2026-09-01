"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, ScanLine, SquarePen, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/molecules/admin";
import {
  Combobox,
  Field,
  Select,
  TextInput,
  Textarea,
} from "@/components/molecules/form";
import {
  NoticeDialog,
  type NoticeTone,
} from "@/components/molecules/notice-dialog/NoticeDialog";
import { useCreateSale, useUpdateSale } from "@/hooks/sales/use-sale-mutations";
import { useGenerateInvoice } from "@/hooks/invoices/use-invoice-mutations";
import { findCustomerByPhone } from "@/services/customer.service";
import { usePermission } from "@/components/auth/permission-context";
import { notify } from "@/lib/toast";
import {
  CUSTOM_ITEM_QTY_MAX,
  firstCustomItemError,
  validateCustomItem,
  type CustomItemValue,
} from "@/lib/pos/custom-item";
import {
  CUSTOMER_REQUIRED_MESSAGE,
  CUSTOMER_REQUIRED_TITLE,
  amountDue,
  hasCustomerIdentity,
  leavesDue,
  roundMoney,
} from "@/lib/pos/sale-payment";
import type { Product, ProductVariant } from "@/types/product.types";
import {
  PAYMENT_METHODS,
  type CustomSaleLine,
  type PaymentMethod,
  type Sale,
  type SaleLineInput,
} from "@/types/sale.types";
import { formatCurrency } from "@/utils/format-currency";
import { toLocalDateStr } from "@/utils/date-range";
import { CustomItemModal } from "./CustomItemModal";
import { FonepayQrModal } from "./FonepayQrModal";
import { SaleInvoiceModal } from "./SaleInvoiceModal";
import type {
  Warehouse,
  WarehouseAvailability,
} from "@/types/warehouse.types";

interface SaleFormProps {
  products: Product[];
  variantsByProduct: Record<string, ProductVariant[]>;
  /** Active warehouses to pick from; the default one prefills the selector. */
  warehouses: Warehouse[];
  /** The signed-in user's default warehouse; prefills new sales when set. */
  userDefaultWarehouseId?: string | null;
  /** This POS device's warehouse (cookie); wins over the user/shop default. */
  deviceWarehouseId?: string | null;
  /** Per-warehouse available (stock − reserved), keyed by warehouse then id. */
  availabilityByWarehouse: WarehouseAvailability;
  currency: { code: string; locale: string };
  /** When provided the form edits this sale; otherwise it creates a new one. */
  sale?: Sale | null;
  /** Called after a sale is successfully recorded/updated. */
  onSaved?: () => void;
  /** Invoked when the user cancels (e.g. close the modal / leave the page). */
  onCancel: () => void;
  /** Show the barcode scan box that adds line items as products are scanned. */
  enableScanner?: boolean;
}

interface DraftLine {
  key: string;
  productId: string;
  variantId: string;
  quantity: string;
  /**
   * Set on custom (non-catalog) lines, where the cashier supplied the name and
   * price. `productId`/`variantId` stay empty on those, and they hold no stock.
   */
  custom?: CustomSaleLine | null;
}

let lineCounter = 0;
function newLine(): DraftLine {
  lineCounter += 1;
  return {
    key: `line-${lineCounter}`,
    productId: "",
    variantId: "",
    quantity: "1",
  };
}

/** True for the untouched starter line, which the first added item replaces. */
function isBlankLine(line: DraftLine): boolean {
  return !line.productId && !line.custom;
}

function linesFromSale(sale: Sale): DraftLine[] {
  const catalog: DraftLine[] = (sale.items ?? []).map((it) => {
    lineCounter += 1;
    return {
      key: `line-${lineCounter}`,
      productId: it.productId ?? "",
      variantId: it.productVariantId ?? "",
      quantity: String(it.quantity),
      custom: null,
    };
  });

  // Extra sales live in their own table, so rebuild them as custom cart lines:
  // the cashier edits them here exactly as they were entered, and the server
  // routes them straight back to `extra_sale_items` on save.
  const extra: DraftLine[] = (sale.extras ?? []).map((it) => {
    lineCounter += 1;
    return {
      key: `line-${lineCounter}`,
      productId: "",
      variantId: "",
      quantity: String(it.quantity),
      custom: { title: it.title, unitPrice: it.unitPrice } as CustomSaleLine,
    };
  });

  const lines = [...catalog, ...extra];
  return lines.length > 0 ? lines : [newLine()];
}

/**
 * The sale create/edit form: all fields, line items, and totals plus the
 * action buttons. Container-agnostic: rendered inside a modal (edit / quick
 * create) or inline on the dedicated "Create New Sale" page.
 */
export function SaleForm({
  products,
  variantsByProduct,
  warehouses,
  userDefaultWarehouseId,
  deviceWarehouseId,
  availabilityByWarehouse,
  currency,
  sale,
  onSaved,
  onCancel,
  enableScanner = false,
}: SaleFormProps) {
  const isEdit = Boolean(sale);
  const router = useRouter();
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();
  const pending = createSale.isPending || updateSale.isPending;

  const activeWarehouses = useMemo(
    () => warehouses.filter((w) => w.isActive || w.id === sale?.warehouseId),
    [warehouses, sale],
  );
  // New-sale prefill priority: this POS device's warehouse → the user's own
  // default → the shop default → the first active warehouse. Each is used only
  // when it points at an active warehouse.
  const deviceDefault =
    deviceWarehouseId &&
    activeWarehouses.some((w) => w.id === deviceWarehouseId)
      ? deviceWarehouseId
      : "";
  const userDefault =
    userDefaultWarehouseId &&
    activeWarehouses.some((w) => w.id === userDefaultWarehouseId)
      ? userDefaultWarehouseId
      : "";
  const defaultWarehouseId =
    deviceDefault ||
    userDefault ||
    warehouses.find((w) => w.isDefault && w.isActive)?.id ||
    activeWarehouses[0]?.id ||
    "";

  const [customerName, setCustomerName] = useState(sale?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(sale?.customerPhone ?? "");
  // Set when the entered phone matches a customer in the directory (POS auto-fill).
  const [customerMatch, setCustomerMatch] = useState<{
    name: string | null;
    pointsBalance: number;
  } | null>(null);
  const [warehouseId, setWarehouseId] = useState(
    sale?.warehouseId ?? defaultWarehouseId,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    sale?.paymentMethod ?? "cash",
  );
  const [saleDate, setSaleDate] = useState(
    sale?.saleDate.slice(0, 10) ?? toLocalDateStr(new Date()),
  );
  const [discount, setDiscount] = useState(
    sale ? String(sale.discountAmount) : "",
  );
  // How `discount` is interpreted: a flat currency amount or a percent of the
  // subtotal. Existing sales only store the final amount, so edits open in
  // "amount" mode. Either way we persist the computed currency amount.
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount",
  );
  const [notes, setNotes] = useState(sale?.notes ?? "");
  const [lines, setLines] = useState<DraftLine[]>(
    sale ? linesFromSale(sale) : [newLine()],
  );
  // Cash taken at the counter. Empty means "the full total", the common case,
  // and it stays correct as the cart changes. Edits manage payments from the
  // sale's detail page instead, so the field is create-only.
  const [amountPaid, setAmountPaid] = useState("");
  const [scanValue, setScanValue] = useState("");
  // Open state for the custom-item prompt. `key` targets an existing custom line
  // (edit); null adds a new one.
  const [customModal, setCustomModal] = useState<{ key: string | null } | null>(
    null,
  );
  // When a Fonepay sale is recorded, hold its id here to open the QR collector.
  const [fonepaySaleId, setFonepaySaleId] = useState<string | null>(null);
  // Once a recorded sale is invoiced, hold the sale + invoice ids to preview it.
  const [invoiceModal, setInvoiceModal] = useState<{
    saleId: string;
    invoiceId: string;
  } | null>(null);

  const generateInvoice = useGenerateInvoice();
  const canGenerateInvoice = usePermission("invoices.generate");

  /** Clear the cart/customer fields for the next POS sale (stays on the page). */
  function resetForm() {
    setCustomerName("");
    setCustomerPhone("");
    setDiscount("");
    setDiscountType("amount");
    setNotes("");
    setLines([newLine()]);
    setAmountPaid("");
    setScanValue("");
    setCustomModal(null);
  }

  /**
   * Finalize a recorded sale: auto-generate its invoice and open the print
   * preview, then finalize. When the user can't generate invoices (or generation
   * fails), skip straight to finalize. Applies to every payment method (Fonepay
   * finalizes here too, after the QR is paid).
   */
  function finishSale(saleId: string) {
    if (!canGenerateInvoice) {
      runFinalize(saleId);
      return;
    }
    generateInvoice.mutate(saleId, {
      onSuccess: (result) => {
        if (result.warning) notify.error(`⚠️ ${result.warning}`);
        if (result.invoiceId) setInvoiceModal({ saleId, invoiceId: result.invoiceId });
        else runFinalize(saleId);
      },
      // useGenerateInvoice already toasts the error; the sale is still recorded.
      onError: () => runFinalize(saleId),
    });
  }

  /**
   * Wrap up a recorded sale and reset for the next one. Nothing is asked here
   * any more: how much was collected is captured on the form before the sale is
   * written, and Fonepay settles itself through its QR callback. An outstanding
   * balance is collected later from the sale's detail page.
   */
  function runFinalize(saleId: string) {
    void saleId;
    resetForm();
    // The POS stays mounted for the next sale, so the availability this form was
    // built from (a server component render) would otherwise never re-run and
    // the cashier would keep seeing pre-sale stock. Every completion path funnels
    // through here, so one refresh covers cash, Fonepay and invoice-skipped sales.
    router.refresh();
  }
  // Blocking scan feedback (e.g. not stocked in the selected warehouse).
  const [notice, setNotice] = useState<{
    title: string;
    description?: string;
    tone: NoticeTone;
  } | null>(null);

  const warehouseName =
    warehouses.find((w) => w.id === warehouseId)?.name ?? "this warehouse";

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  // When editing, this sale's own stock is already deducted, so `available`
  // understates what we can use. Add each original line's quantity back when
  // validating so an unchanged edit isn't falsely blocked. Keyed by product+variant.
  const originalQtyByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of sale?.items ?? []) {
      const key = `${it.productId ?? ""}:${it.productVariantId ?? ""}`;
      map.set(key, (map.get(key) ?? 0) + it.quantity);
    }
    return map;
  }, [sale]);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  /**
   * Resolve a scanned/typed code to a product (and variant, if any). Matches in
   * priority order: variant barcode → simple-product barcode → variant SKU →
   * simple-product SKU. Variant products are only matched via a variant-specific
   * code, since a scan must identify one sellable item.
   */
  function resolveScan(
    raw: string,
  ): { product: Product; variant: ProductVariant | null } | null {
    const lc = raw.trim().toLowerCase();
    if (!lc) return null;

    for (const [productId, variants] of Object.entries(variantsByProduct)) {
      const v = variants.find((vr) => vr.barcode?.toLowerCase() === lc);
      if (v) {
        const product = productById.get(productId);
        if (product) return { product, variant: v };
      }
    }

    const pByBarcode = products.find(
      (p) => !p.hasVariants && p.barcode?.toLowerCase() === lc,
    );
    if (pByBarcode) return { product: pByBarcode, variant: null };

    for (const [productId, variants] of Object.entries(variantsByProduct)) {
      const v = variants.find((vr) => vr.sku?.toLowerCase() === lc);
      if (v) {
        const product = productById.get(productId);
        if (product) return { product, variant: v };
      }
    }

    const pBySku = products.find(
      (p) => !p.hasVariants && p.sku.toLowerCase() === lc,
    );
    if (pBySku) return { product: pBySku, variant: null };

    return null;
  }

  /** Add a scanned item: bump an existing matching line, or add a new one. */
  function handleScan() {
    const code = scanValue.trim();
    if (!code) return;
    setScanValue("");

    const match = resolveScan(code);
    if (!match) {
      setNotice({
        title: "No product found",
        description: `Nothing in the catalog matches "${code}". Check the barcode, add the product first, or use “Add extra item” to sell it as a one-off.`,
        tone: "danger",
      });
      return;
    }
    const { product, variant } = match;
    const variantId = variant?.id ?? "";
    const label = variant
      ? `${product.title} · ${variant.displayName}`
      : product.title;

    // Effective stock for this exact product/variant in the selected warehouse.
    const available =
      effectiveAvailableFor({
        key: "scan",
        productId: product.id,
        variantId,
        quantity: "0",
      }) ?? 0;

    // Found in the catalog but not stocked in the chosen warehouse.
    if (available < 1) {
      setNotice({
        title: `Not available in ${warehouseName}`,
        description: `"${label}" has no stock in ${warehouseName}. Switch warehouse or transfer stock in first.`,
        tone: "warning",
      });
      return;
    }

    const existing = lines.find(
      (l) => l.productId === product.id && l.variantId === variantId,
    );
    if (existing) {
      const next = (parseInt(existing.quantity, 10) || 0) + 1;
      if (next > available) {
        setNotice({
          title: "Not enough stock",
          description: `Only ${available} of "${label}" left in ${warehouseName}.`,
          tone: "warning",
        });
        return;
      }
      updateLine(existing.key, { quantity: String(next) });
      notify.success(`${label} ×${next}`);
      return;
    }

    const line: DraftLine = { ...newLine(), productId: product.id, variantId, quantity: "1" };
    // Replace the lone empty starter line so the first scan doesn't leave a blank.
    setLines((prev) =>
      prev.length === 1 && isBlankLine(prev[0]) ? [line] : [...prev, line],
    );
    notify.success(`Added ${label}.`);
  }

  /** The custom line the modal is editing, in the shape the modal expects. */
  const editingCustom: CustomItemValue | null = (() => {
    if (!customModal?.key) return null;
    const line = lines.find((l) => l.key === customModal.key);
    if (!line?.custom) return null;
    return {
      title: line.custom.title,
      unitPrice: line.custom.unitPrice,
      quantity: parseInt(line.quantity, 10) || 1,
    };
  })();

  /** Commit the modal: update the targeted custom line, or append a new one. */
  function handleCustomItem(value: CustomItemValue) {
    const custom: CustomSaleLine = {
      title: value.title,
      unitPrice: value.unitPrice,
    };
    const editKey = customModal?.key;
    if (editKey) {
      updateLine(editKey, { custom, quantity: String(value.quantity) });
    } else {
      const line: DraftLine = {
        ...newLine(),
        custom,
        quantity: String(value.quantity),
      };
      setLines((prev) =>
        prev.length === 1 && isBlankLine(prev[0]) ? [line] : [...prev, line],
      );
      notify.success(`Added ${value.title}.`);
    }
    setCustomModal(null);
  }

  function unitPriceFor(line: DraftLine): number | null {
    if (line.custom) return line.custom.unitPrice;
    const product = productById.get(line.productId);
    if (!product) return null;
    if (product.hasVariants) {
      const variant = (variantsByProduct[product.id] ?? []).find(
        (v) => v.id === line.variantId,
      );
      return variant ? (variant.priceOverride ?? product.price) : null;
    }
    return product.price;
  }

  /** Available for the selected warehouse (0 when the item isn't stocked there). */
  function availableFor(line: DraftLine): number | null {
    // Custom lines aren't stocked, so they have no availability to check.
    if (line.custom) return null;
    const product = productById.get(line.productId);
    if (!product) return null;
    const bucket = availabilityByWarehouse[warehouseId];
    if (product.hasVariants) {
      if (!line.variantId) return null;
      return bucket?.variants[line.variantId] ?? 0;
    }
    return bucket?.products[product.id] ?? 0;
  }

  /** Available stock plus this sale's own previously-deducted quantity (edit). */
  function effectiveAvailableFor(line: DraftLine): number | null {
    const available = availableFor(line);
    if (available === null) return null;
    const key = `${line.productId}:${line.variantId}`;
    return available + (originalQtyByKey.get(key) ?? 0);
  }

  // ── Warehouse-scoped availability, for hiding out-of-stock items ──
  // "Effective" = warehouse availability plus any quantity this sale itself
  // already holds (so editing an existing line never hides its own product).
  const bucket = availabilityByWarehouse[warehouseId];

  function variantEffectiveAvail(productId: string, variantId: string): number {
    const raw = bucket?.variants[variantId] ?? 0;
    return raw + (originalQtyByKey.get(`${productId}:${variantId}`) ?? 0);
  }

  function productEffectiveAvail(product: Product): number {
    if (product.hasVariants) {
      return (variantsByProduct[product.id] ?? []).reduce(
        (sum, v) => sum + variantEffectiveAvail(product.id, v.id),
        0,
      );
    }
    const raw = bucket?.products[product.id] ?? 0;
    return raw + (originalQtyByKey.get(`${product.id}:`) ?? 0);
  }

  // Products with any stock in the selected warehouse: the only ones offered in
  // the picker. Recomputed when the warehouse changes.
  const selectableProducts = useMemo(
    () => products.filter((p) => productEffectiveAvail(p) > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, warehouseId, availabilityByWarehouse, originalQtyByKey, variantsByProduct],
  );

  /** Options for a line's product select: available products + the one already
   * chosen on this line (so a selected-but-now-unavailable item still shows). */
  function productOptionsFor(line: DraftLine): Product[] {
    if (!line.productId) return selectableProducts;
    if (selectableProducts.some((p) => p.id === line.productId)) {
      return selectableProducts;
    }
    const current = productById.get(line.productId);
    return current ? [current, ...selectableProducts] : selectableProducts;
  }

  /** Variant options for a line: those with stock here + the chosen one. */
  function variantOptionsFor(line: DraftLine): ProductVariant[] {
    const all = variantsByProduct[line.productId] ?? [];
    return all.filter(
      (v) =>
        variantEffectiveAvail(line.productId, v.id) > 0 || v.id === line.variantId,
    );
  }

  const subtotal = lines.reduce((sum, line) => {
    const price = unitPriceFor(line);
    const qty = parseInt(line.quantity, 10);
    return price && qty > 0 ? sum + price * qty : sum;
  }, 0);
  // Raw entered number, then the currency discount it resolves to. A percentage
  // is capped at 100%; a flat amount can't exceed the subtotal. Both are clamped
  // again server-side.
  const discountInput = Math.max(0, parseFloat(discount) || 0);
  const discountValue =
    discountType === "percent"
      ? (subtotal * Math.min(discountInput, 100)) / 100
      : Math.min(discountInput, subtotal);
  const total = roundMoney(Math.max(0, subtotal - discountValue));

  // Fonepay collects the whole total through its QR, so the counter amount
  // doesn't apply there. Everywhere else, an empty field means "paid in full".
  const collectsAtCounter = !isEdit && paymentMethod !== "fonepay";
  const paidNow = collectsAtCounter
    ? amountPaid.trim() === ""
      ? total
      : Math.min(Math.max(0, roundMoney(parseFloat(amountPaid) || 0)), total)
    : total;
  const due = amountDue(total, paidNow);
  // A due can only be carried by a named, reachable customer: there has to be
  // someone to collect the rest from.
  const carriesDue = collectsAtCounter && leavesDue(total, paidNow);
  const customerIdentified = hasCustomerIdentity({
    name: customerName,
    phone: customerPhone,
  });

  // On blur of the phone field, look the customer up and prefill the name if
  // it's empty. Shows a "returning customer" badge with their points balance.
  async function handlePhoneLookup() {
    const phone = customerPhone.trim();
    // Only look up once at least 10 digits have been entered (a full number).
    if (phone.replace(/\D/g, "").length < 10) {
      setCustomerMatch(null);
      return;
    }
    try {
      const match = await findCustomerByPhone(phone);
      if (match) {
        setCustomerMatch({
          name: match.name,
          pointsBalance: match.pointsBalance,
        });
        if (!customerName.trim() && match.name) setCustomerName(match.name);
      } else {
        setCustomerMatch(null);
      }
    } catch {
      setCustomerMatch(null);
    }
  }

  function handleSubmit() {
    if (!saleDate) {
      notify.error("Choose a sale date.");
      return;
    }
    if (!warehouseId) {
      notify.error("Choose a warehouse.");
      return;
    }

    // Customer phone is optional, but when provided it must be a full number so
    // it reliably identifies (and links to) a customer in the directory.
    const phoneTrimmed = customerPhone.trim();
    if (phoneTrimmed && phoneTrimmed.replace(/\D/g, "").length < 10) {
      notify.error("Customer phone must be at least 10 digits.");
      return;
    }

    const items: SaleLineInput[] = [];
    for (const line of lines) {
      // Custom lines carry their own name and price, so re-validate them here
      // an inline quantity edit can't slip past the modal's checks.
      if (line.custom) {
        const { errors, value } = validateCustomItem({
          title: line.custom.title,
          unitPrice: line.custom.unitPrice,
          quantity: line.quantity,
        });
        if (!value) {
          notify.error(
            `"${line.custom.title}": ${
              firstCustomItemError(errors) ?? "check this custom item."
            }`,
          );
          return;
        }
        items.push({
          productId: "",
          quantity: value.quantity,
          custom: { title: value.title, unitPrice: value.unitPrice },
        });
        continue;
      }
      if (!line.productId) continue;
      const product = productById.get(line.productId);
      const qty = parseInt(line.quantity, 10);
      if (!product || !qty || qty <= 0) {
        notify.error("Each line needs a product and a positive quantity.");
        return;
      }
      if (product.hasVariants && !line.variantId) {
        notify.error(`Choose a variant for "${product.title}".`);
        return;
      }
      const available = effectiveAvailableFor(line);
      if (available !== null && qty > available) {
        const label = product.hasVariants
          ? `${product.title} (${
              (variantsByProduct[product.id] ?? []).find(
                (v) => v.id === line.variantId,
              )?.displayName ?? "variant"
            })`
          : product.title;
        notify.error(
          `Only ${available} of "${label}" in stock. Reduce the quantity.`,
        );
        return;
      }
      items.push({
        productId: line.productId,
        productVariantId: product.hasVariants ? line.variantId : null,
        quantity: qty,
      });
    }

    if (items.length === 0) {
      notify.error("Add at least one product.");
      return;
    }

    // The blocking rule the whole due-tracking feature rests on. Checked here
    // so nothing is written, and re-checked server-side.
    if (carriesDue && !customerIdentified) {
      setNotice({
        title: CUSTOMER_REQUIRED_TITLE,
        description: CUSTOMER_REQUIRED_MESSAGE,
        tone: "warning",
      });
      return;
    }

    const input = {
      customerName: customerName.trim() || null,
      customerPhone: customerPhone.trim() || null,
      paymentMethod,
      warehouseId,
      saleDate,
      discountAmount: discountValue,
      amountPaid: paidNow,
      notes: notes.trim() || null,
      items,
    };

    if (isEdit && sale) {
      updateSale.mutate(
        { id: sale.id, input },
        {
          onSuccess: () => {
            notify.success("Sale updated.");
            // An edit re-deducts stock, so re-run the server render behind it.
            router.refresh();
            onSaved?.();
          },
        },
      );
    } else {
      createSale.mutate(input, {
        onSuccess: (data) => {
          // Fonepay sales are recorded as pending: open the QR collector and
          // finish only once the customer has paid (or the payment is cancelled).
          if (paymentMethod === "fonepay" && data.saleId) {
            setFonepaySaleId(data.saleId);
            return;
          }
          notify.success("Sale recorded.");
          // Every other method is settled immediately: invoice + preview, then
          // reset for the next sale (stays on the POS page).
          if (data.saleId) finishSale(data.saleId);
          else onSaved?.();
        },
      });
    }
  }

  return (
    <div>
      {enableScanner && (
        <div className="mb-5">
          <div className="flex items-center gap-2 rounded-xl border border-admin-accent/40 bg-admin-accent/5 px-4 transition-colors focus-within:border-admin-accent">
            <ScanLine className="h-5 w-5 shrink-0 text-admin-accent" />
            <input
              type="text"
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScan();
                }
              }}
              placeholder="Scan or type a barcode, then press Enter"
              aria-label="Scan product barcode"
              autoFocus
              className="w-full bg-transparent py-3 text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-admin-text-muted">
            Scanning adds the product to the sale and bumps its quantity on repeat
            scans.
          </p>
        </div>
      )}

      {/* Line items (product selection first), highlighted so the cashier's
          eye is drawn to where scanned items land. */}
      <div className="rounded-2xl border border-admin-accent/30 bg-admin-accent/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-admin-text-muted">
            Items
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCustomModal({ key: null })}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-admin-text-muted transition-colors hover:bg-admin-accent/10 hover:text-admin-accent"
            >
              <SquarePen className="h-3.5 w-3.5" /> Add extra item
            </button>
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, newLine()])}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-admin-accent transition-colors hover:bg-admin-accent/10"
            >
              <Plus className="h-3.5 w-3.5" /> Add item
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {lines.map((line) => {
            // Custom lines have no catalog controls: the name/price come from
            // the prompt (re-openable here), only the quantity is inline.
            if (line.custom) {
              const custom = line.custom;
              return (
                <div
                  key={line.key}
                  className="grid grid-cols-12 items-end gap-2 rounded-xl border border-admin-accent/40 bg-admin-card/30 p-3"
                >
                  <div className="col-span-8 min-w-0">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-admin-text-muted">
                      Extra sale
                    </p>
                    <button
                      type="button"
                      onClick={() => setCustomModal({ key: line.key })}
                      className="flex w-full items-center gap-2 rounded-lg text-left text-sm font-semibold text-admin-text transition-colors hover:text-admin-accent"
                    >
                      <span className="truncate">{custom.title}</span>
                      <Pencil className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    </button>
                    <p className="mt-0.5 text-[11px] text-admin-text-muted">
                      {formatCurrency(
                        custom.unitPrice,
                        currency.code,
                        currency.locale,
                      )}{" "}
                      each · not stocked, excluded from product profit
                    </p>
                  </div>

                  <div className="col-span-2">
                    <Field label="Qty">
                      {(p) => (
                        <TextInput
                          type="number"
                          min="1"
                          max={CUSTOM_ITEM_QTY_MAX}
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.key, { quantity: e.target.value })
                          }
                          {...p}
                        />
                      )}
                    </Field>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-2 pb-2">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((l) => l.key !== line.key),
                          )
                        }
                        aria-label={`Remove ${custom.title}`}
                        className="rounded-lg p-1.5 text-admin-danger/60 transition-colors hover:bg-admin-danger/10 hover:text-admin-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            const product = productById.get(line.productId);
            const variants = product?.hasVariants ? variantOptionsFor(line) : [];
            const productOptions = productOptionsFor(line);
            const available = availableFor(line);
            const qty = parseInt(line.quantity, 10);
            const overStock =
              available !== null &&
              qty > 0 &&
              qty > (effectiveAvailableFor(line) ?? available);
            return (
              <div
                key={line.key}
                className="grid grid-cols-12 items-end gap-2 rounded-xl border border-admin-border bg-admin-card/30 p-3"
              >
                <div className={product?.hasVariants ? "col-span-5" : "col-span-8"}>
                  <Field label="Product">
                    {(p) => (
                      <Combobox
                        value={line.productId}
                        onChange={(value) =>
                          updateLine(line.key, {
                            productId: value,
                            variantId: "",
                          })
                        }
                        options={productOptions.map((prod) => ({
                          value: prod.id,
                          label: prod.title,
                          hint: prod.sku || undefined,
                        }))}
                        placeholder={
                          productOptions.length === 0
                            ? `No products stocked in ${warehouseName}`
                            : "Select a product…"
                        }
                        searchPlaceholder="Search by name or SKU…"
                        emptyMessage="No products match your search."
                        disabled={productOptions.length === 0}
                        {...p}
                      />
                    )}
                  </Field>
                </div>

                {product?.hasVariants && (
                  <div className="col-span-3">
                    <Field label="Variant">
                      {(p) => (
                        <Select
                          value={line.variantId}
                          onChange={(e) =>
                            updateLine(line.key, { variantId: e.target.value })
                          }
                          {...p}
                        >
                          <option value="">Select…</option>
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.displayName}
                              {v.sku ? ` · ${v.sku}` : ""} (
                              {availabilityByWarehouse[warehouseId]?.variants[v.id] ?? 0} left)
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  </div>
                )}

                <div className="col-span-2">
                  <Field label="Qty">
                    {(p) => (
                      <TextInput
                        type="number"
                        min="1"
                        max={effectiveAvailableFor(line) ?? undefined}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, { quantity: e.target.value })
                        }
                        {...p}
                      />
                    )}
                  </Field>
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2 pb-2">
                  {available !== null && (
                    <span
                      className={
                        overStock
                          ? "text-[11px] font-semibold text-admin-danger"
                          : "text-[11px] text-admin-text-muted"
                      }
                    >
                      {available} avail.
                    </span>
                  )}
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLines((prev) => prev.filter((l) => l.key !== line.key))
                      }
                      aria-label="Remove item"
                      className="rounded-lg p-1.5 text-admin-danger/60 transition-colors hover:bg-admin-danger/10 hover:text-admin-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-admin-border pt-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Field label="Discount">
              {(p) => (
                <div className="flex gap-2">
                  <TextInput
                    type="number"
                    step={discountType === "percent" ? "1" : "0.01"}
                    min="0"
                    max={discountType === "percent" ? "100" : undefined}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder={discountType === "percent" ? "0" : "0.00"}
                    {...p}
                  />
                  <div
                    role="group"
                    aria-label="Discount type"
                    className="flex shrink-0 items-stretch rounded-xl border border-admin-border p-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => setDiscountType("amount")}
                      aria-pressed={discountType === "amount"}
                      className={cn(
                        "rounded-lg px-3 text-sm font-bold transition-colors",
                        discountType === "amount"
                          ? "bg-admin-accent text-white"
                          : "text-admin-text-muted hover:bg-admin-card",
                      )}
                    >
                      {currency.code}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("percent")}
                      aria-pressed={discountType === "percent"}
                      className={cn(
                        "rounded-lg px-3 text-sm font-bold transition-colors",
                        discountType === "percent"
                          ? "bg-admin-accent text-white"
                          : "text-admin-text-muted hover:bg-admin-card",
                      )}
                    >
                      %
                    </button>
                  </div>
                </div>
              )}
            </Field>
            {collectsAtCounter && (
              <Field
                label="Amount received"
                hint={
                  carriesDue
                    ? "The rest is tracked as due. Customer name and phone are required."
                    : "Leave empty when the customer pays in full."
                }
              >
                {(p) => (
                  <div className="flex gap-2">
                    <TextInput
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      max={total}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder={formatCurrency(
                        total,
                        currency.code,
                        currency.locale,
                      )}
                      hasError={carriesDue && !customerIdentified}
                      {...p}
                    />
                    <button
                      type="button"
                      onClick={() => setAmountPaid("")}
                      className="shrink-0 rounded-xl border border-admin-border px-3 text-sm font-bold text-admin-text-muted transition-colors hover:bg-admin-card hover:text-admin-text"
                    >
                      Full
                    </button>
                  </div>
                )}
              </Field>
            )}
            <Field label="Notes">
              {(p) => (
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional internal note"
                  {...p}
                />
              )}
            </Field>
          </div>
          <div className="flex flex-col justify-end gap-1 text-right">
            <div className="flex items-center justify-between text-sm text-admin-text-muted">
              <span>Subtotal</span>
              <span className="font-semibold text-admin-text">
                {formatCurrency(subtotal, currency.code, currency.locale)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-admin-text-muted">
              <span>
                Discount
                {discountType === "percent" && discountInput > 0
                  ? ` (${Math.min(discountInput, 100)}%)`
                  : ""}
              </span>
              <span className="font-semibold text-admin-text">
                −{formatCurrency(discountValue, currency.code, currency.locale)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-admin-border pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-admin-text-muted">
                Total
              </span>
              <span className="text-lg font-extrabold text-admin-text">
                {formatCurrency(total, currency.code, currency.locale)}
              </span>
            </div>
            {/* Only worth showing once the sale isn't settled at the counter. */}
            {carriesDue && (
              <>
                <div className="mt-1 flex items-center justify-between text-sm text-admin-text-muted">
                  <span>Received</span>
                  <span className="font-semibold text-admin-text">
                    {formatCurrency(paidNow, currency.code, currency.locale)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-amber-600">Due</span>
                  <span className="text-base font-extrabold text-amber-600">
                    {formatCurrency(due, currency.code, currency.locale)}
                  </span>
                </div>
                {!customerIdentified && (
                  <p className="mt-1 text-right text-[11px] font-semibold text-admin-danger">
                    Customer name and phone required to carry a due.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sale context */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Warehouse" required hint="Stock is deducted from this location.">
          {(p) => (
            <Select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              {...p}
            >
              {activeWarehouses.length === 0 && (
                <option value="">No warehouses</option>
              )}
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.isDefault ? " (default)" : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Payment method" required>
          {(p) => (
            <Select
              value={paymentMethod}
              onChange={(e) => {
                const next = e.target.value as PaymentMethod;
                setPaymentMethod(next);
                // Credit / Due means nothing is collected now; any other method
                // goes back to the "paid in full" default.
                setAmountPaid(next === "credit" ? "0" : "");
              }}
              {...p}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Sale date" required>
          {(p) => (
            <TextInput
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              {...p}
            />
          )}
        </Field>
      </div>

      {/* Customer details: enter the phone first to auto-fill a returning customer */}
      <div className="mt-6">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-admin-text-muted">
          Customer details
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Customer phone"
            hint="At least 10 digits. Enter first to auto-fill returning customers."
          >
            {(p) => (
              <>
                <TextInput
                  type="tel"
                  inputMode="numeric"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    setCustomerMatch(null);
                  }}
                  onBlur={handlePhoneLookup}
                  placeholder="Optional"
                  {...p}
                />
                {customerMatch && (
                  <p className="mt-1 text-[11px] font-semibold text-admin-accent">
                    Returning customer · {customerMatch.pointsBalance} pts
                  </p>
                )}
              </>
            )}
          </Field>
          <Field label="Customer name">
            {(p) => (
              <TextInput
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Optional"
                {...p}
              />
            )}
          </Field>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-end gap-3 border-t border-admin-border pt-4">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handleSubmit}
          loading={pending}
        >
          {pending ? "Saving..." : isEdit ? "Save changes" : "Record sale"}
        </Button>
      </div>

      <CustomItemModal
        open={customModal !== null}
        currency={currency}
        initial={editingCustom}
        onSubmit={handleCustomItem}
        onClose={() => setCustomModal(null)}
      />

      <NoticeDialog
        open={notice !== null}
        onClose={() => setNotice(null)}
        title={notice?.title ?? ""}
        description={notice?.description}
        tone={notice?.tone ?? "info"}
      />

      {fonepaySaleId && (
        <FonepayQrModal
          saleId={fonepaySaleId}
          currency={currency}
          onPaid={() => {
            const sid = fonepaySaleId;
            setFonepaySaleId(null);
            // Finalize like any other method: invoice + preview, then reset.
            if (sid) finishSale(sid);
          }}
          onCancelled={() => setFonepaySaleId(null)}
        />
      )}

      {invoiceModal && (
        <SaleInvoiceModal
          invoiceId={invoiceModal.invoiceId}
          currency={currency}
          onClose={() => {
            const sid = invoiceModal.saleId;
            setInvoiceModal(null);
            // Confirm payment (non-Fonepay) and reset for the next sale.
            runFinalize(sid);
          }}
        />
      )}
    </div>
  );
}
