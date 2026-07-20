"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";
import {
  useCloseSession,
  useCreateRegister,
  useCreateSale,
  useCurrentSession,
  useOpenSession,
  usePosProducts,
  usePosRegisters,
  useSessionSales,
  type CreateSaleInput,
  type PosProduct,
  type PosSession,
} from "@/lib/queries/pos";

// ===================== Types =====================

interface CartItem {
  productServiceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxInclusive: boolean;
}

// ===================== Main Component =====================

export function PosClient() {
  const t = useT();
  const { data: session, isLoading } = useCurrentSession();

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <p className="text-zinc-500">{t("common.loading")}</p>
      </div>
    );
  }

  if (!session || session.status !== "OPEN") {
    return <OpenSessionView />;
  }

  return <RegisterView session={session} />;
}

// ===================== Open Session View =====================

function OpenSessionView() {
  const t = useT();
  const { data: registers } = usePosRegisters();
  const openSession = useOpenSession();
  const createRegister = useCreateRegister();
  const [selectedRegister, setSelectedRegister] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [newRegisterName, setNewRegisterName] = useState("");

  const handleOpen = () => {
    if (!selectedRegister) return;
    openSession.mutate({ registerId: selectedRegister, openingBalance: Number(openingBalance) });
  };

  const handleCreateRegister = () => {
    if (!newRegisterName.trim()) return;
    createRegister.mutate(newRegisterName.trim(), {
      onSuccess: () => setNewRegisterName(""),
    });
  };

  return (
    <div className="mx-auto max-w-md space-y-6 pt-16">
      <Card>
        <CardHeader>
          <CardTitle>{t("pos.openSession")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("pos.register")}</Label>
            <select
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-900"
              value={selectedRegister}
              onChange={(e) => setSelectedRegister(e.target.value)}
            >
              <option value="">{t("pos.selectRegister")}</option>
              {registers?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("pos.openingBalance")}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleOpen}
            disabled={!selectedRegister || openSession.isPending}
          >
            {t("pos.startSession")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pos.newRegister")}</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder={t("pos.registerName")}
            value={newRegisterName}
            onChange={(e) => setNewRegisterName(e.target.value)}
          />
          <Button onClick={handleCreateRegister} disabled={createRegister.isPending}>
            {t("common.add")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== Register View (Main POS) =====================

function RegisterView({ session }: { session: PosSession }) {
  const t = useT();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [showPayment, setShowPayment] = useState(false);
  const [showClose, setShowClose] = useState(false);

  const { data: products } = usePosProducts(search);
  const { data: sales } = useSessionSales(session.id);
  const createSale = useCreateSale();
  const closeSession = useCloseSession();
  const [closingBalance, setClosingBalance] = useState("");

  const addToCart = useCallback((product: PosProduct) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productServiceId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productServiceId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          productServiceId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: Number(product.salePrice ?? 0),
          taxRate: product.defaultTaxRate ? Number(product.defaultTaxRate.rate) : 0,
          taxInclusive: product.defaultTaxRate?.calculationType === "INCLUSIVE",
        },
      ];
    });
    setSearch("");
  }, []);

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.productServiceId !== productId));
    } else {
      setCart((prev) =>
        prev.map((i) => (i.productServiceId === productId ? { ...i, quantity: qty } : i)),
      );
    }
  };

  const { subtotal, tax, total } = useMemo(() => {
    let sub = 0;
    let tx = 0;
    for (const item of cart) {
      const lineTotal = item.quantity * item.unitPrice;
      if (item.taxInclusive) {
        const net = lineTotal / (1 + item.taxRate / 100);
        tx += lineTotal - net;
        sub += lineTotal;
      } else {
        tx += lineTotal * (item.taxRate / 100);
        sub += lineTotal;
      }
    }
    return { subtotal: sub, tax: tx, total: sub + (cart.some((i) => !i.taxInclusive) ? tx : 0) };
  }, [cart]);

  const handleCompleteSale = (amountPaid: number) => {
    const input: CreateSaleInput = {
      sessionId: session.id,
      paymentMethod,
      amountPaid,
      lines: cart.map((item) => ({
        productServiceId: item.productServiceId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    };
    createSale.mutate(input, {
      onSuccess: () => {
        setCart([]);
        setShowPayment(false);
      },
    });
  };

  const handleClose = () => {
    closeSession.mutate({ sessionId: session.id, closingBalance: Number(closingBalance) });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row gap-4 p-4">
      {/* Left: Product search + grid */}
      <div className="flex flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex items-center gap-2">
          <Badge variant="default">{session.register.name}</Badge>
          <span className="text-sm text-zinc-500">
            {t("pos.sessionActive")}
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={() => setShowClose(true)}
          >
            {t("pos.endSession")}
          </Button>
        </div>

        <Input
          placeholder={t("pos.searchProducts")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        {search.length > 0 && products && products.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 overflow-y-auto max-h-[60vh]">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="rounded-lg border p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-zinc-500">{p.sku ?? "—"}</p>
                <p className="text-sm font-bold mt-1">
                  &euro;{Number(p.salePrice ?? 0).toFixed(2)}
                </p>
              </button>
            ))}
          </div>
        )}

        {search.length > 0 && products && products.length === 0 && (
          <p className="text-sm text-zinc-400 py-4 text-center">{t("pos.noProducts")}</p>
        )}

        {/* Recent sales */}
        {!search && sales && sales.length > 0 && (
          <div className="mt-4 overflow-y-auto">
            <h3 className="text-sm font-medium text-zinc-500 mb-2">{t("pos.recentSales")}</h3>
            <div className="space-y-1">
              {sales.slice(0, 10).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                >
                  <span className="font-mono">#{s.saleNumber}</span>
                  <span>&euro;{Number(s.totalAmount).toFixed(2)}</span>
                  <Badge variant={s.paymentMethod === "CASH" ? "default" : "outline"}>
                    {s.paymentMethod}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Cart */}
      <div className="w-full lg:w-96 flex flex-col border rounded-xl bg-white dark:bg-zinc-900 shadow-sm">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">{t("pos.cart")}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-8">{t("pos.emptyCart")}</p>
          )}
          {cart.map((item) => (
            <div key={item.productServiceId} className="flex items-center gap-2 border-b pb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-zinc-500">
                  &euro;{item.unitPrice.toFixed(2)} &times; {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="h-7 w-7 rounded border text-center text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => updateQuantity(item.productServiceId, item.quantity - 1)}
                >
                  -
                </button>
                <span className="w-6 text-center text-sm">{item.quantity}</span>
                <button
                  className="h-7 w-7 rounded border text-center text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => updateQuantity(item.productServiceId, item.quantity + 1)}
                >
                  +
                </button>
              </div>
              <p className="w-16 text-right text-sm font-medium">
                &euro;{(item.quantity * item.unitPrice).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Totals + pay */}
        <div className="border-t p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span>{t("pos.subtotal")}</span>
            <span>&euro;{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-zinc-500">
            <span>{t("pos.tax")}</span>
            <span>&euro;{tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>{t("pos.total")}</span>
            <span>&euro;{total.toFixed(2)}</span>
          </div>

          <div className="flex gap-2">
            <select
              className="flex-1 rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-900"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="CASH">{t("pos.cash")}</option>
              <option value="CARD">{t("pos.card")}</option>
              <option value="BANK_TRANSFER">{t("pos.bankTransfer")}</option>
            </select>
          </div>

          <Button
            className="w-full h-12 text-lg"
            disabled={cart.length === 0 || createSale.isPending}
            onClick={() => setShowPayment(true)}
          >
            {t("pos.charge")} &euro;{total.toFixed(2)}
          </Button>

          {cart.length > 0 && (
            <Button variant="secondary" className="w-full" onClick={() => setCart([])}>
              {t("pos.clearCart")}
            </Button>
          )}
        </div>
      </div>

      {/* Payment dialog */}
      {showPayment && (
        <PaymentModal
          total={total}
          paymentMethod={paymentMethod}
          onConfirm={handleCompleteSale}
          onCancel={() => setShowPayment(false)}
          isPending={createSale.isPending}
        />
      )}

      {/* Close session dialog */}
      {showClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>{t("pos.closeSession")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t("pos.closingBalance")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowClose(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleClose} disabled={closeSession.isPending}>
                  {t("pos.confirmClose")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ===================== Payment Modal =====================

function PaymentModal({
  total,
  paymentMethod,
  onConfirm,
  onCancel,
  isPending,
}: {
  total: number;
  paymentMethod: string;
  onConfirm: (amountPaid: number) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const t = useT();
  const [amountPaid, setAmountPaid] = useState(total.toFixed(2));
  const change = Math.max(0, Number(amountPaid) - total);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("pos.payment")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-3xl font-bold">&euro;{total.toFixed(2)}</p>
            <p className="text-sm text-zinc-500">{paymentMethod}</p>
          </div>

          {paymentMethod === "CASH" && (
            <>
              <div>
                <Label>{t("pos.amountReceived")}</Label>
                <Input
                  type="number"
                  min={total}
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  autoFocus
                />
              </div>
              {change > 0 && (
                <div className="rounded-md bg-green-50 p-3 text-center dark:bg-green-900/20">
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("pos.change")}</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    &euro;{change.toFixed(2)}
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button
              className="flex-1"
              onClick={() => onConfirm(Number(amountPaid))}
              disabled={isPending || Number(amountPaid) < total}
            >
              {t("pos.confirm")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
