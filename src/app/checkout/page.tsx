"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  CanceledCoupon,
  CanceledItem,
  CashMovement,
  CashSession,
  CompanySettings,
  Customer,
  Operator,
  PaymentMethod,
  Product,
  Sale,
} from "@/lib/types";
import { calculateCartTotal, getUnitPriceByPayment } from "@/lib/pricing";
import { money } from "@/lib/format";
import { formatCpf, generateSaleNumber, nowIso, onlyDigits } from "@/lib/utils";
import { calculateCashClosureReport } from "@/lib/cash";
import {
  clearOperatorSession,
  getOperatorSession,
  type CashOperatorSession,
} from "@/lib/operatorSession";
import { useRouter } from "next/navigation";

type CartLine = {
  productId: string;
  productName: string;
  internalCode: string;
  eanCode?: string;
  unitType: string;
  quantity: number;
  unitPriceCash: number;
  unitPriceCard: number;
};

const WITHDRAWAL_ALERT_LIMIT = 300;

function createOperationId() {
  return `OP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export default function CheckoutPage() {
  const router = useRouter();

  const [operatorSession, setOperatorSession] = useState<CashOperatorSession | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [sessionSales, setSessionSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cardType, setCardType] = useState<"debit" | "credit" | "">("");
  const [customerId, setCustomerId] = useState("");
  const [identifyCustomer, setIdentifyCustomer] = useState(false);

  const [productSearch, setProductSearch] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [manualUnitPriceInput, setManualUnitPriceInput] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [currentOperationId, setCurrentOperationId] = useState(createOperationId());

  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showProductConsultModal, setShowProductConsultModal] = useState(false);
  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showCpfModal, setShowCpfModal] = useState(true);
  const [showRemoveItemModal, setShowRemoveItemModal] = useState(false);
  const [showCancelCouponModal, setShowCancelCouponModal] = useState(false);

  const [consultFilter, setConsultFilter] = useState("");
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  const [exitUsername, setExitUsername] = useState("");
  const [exitPassword, setExitPassword] = useState("");

  const [openingAmountInput, setOpeningAmountInput] = useState("0,00");
  const [withdrawalAmountInput, setWithdrawalAmountInput] = useState("0,00");
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [trayAmountInput, setTrayAmountInput] = useState("0,00");
  const [closeAndPrint, setCloseAndPrint] = useState(true);

  const [amountReceivedInput, setAmountReceivedInput] = useState("0,00");

  const [cpfLookupInput, setCpfLookupInput] = useState("");
  const [cpfLookupMessage, setCpfLookupMessage] = useState("");

  const [removeItemIndex, setRemoveItemIndex] = useState<number | null>(null);
  const [removeItemReason, setRemoveItemReason] = useState("");

  const [cancelCouponReason, setCancelCouponReason] = useState("");

  const [withdrawalAlertShown, setWithdrawalAlertShown] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const unitPriceInputRef = useRef<HTMLInputElement | null>(null);

  const finalizePaymentRef = useRef<HTMLSelectElement | null>(null);
  const finalizeAmountReceivedRef = useRef<HTMLInputElement | null>(null);
  const finalizeCardTypeRef = useRef<HTMLSelectElement | null>(null);
  const finalizeConfirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const withdrawalAmountRef = useRef<HTMLInputElement | null>(null);
  const withdrawalReasonRef = useRef<HTMLInputElement | null>(null);
  const withdrawalConfirmRef = useRef<HTMLButtonElement | null>(null);

  const openCashAmountRef = useRef<HTMLInputElement | null>(null);
  const openCashConfirmRef = useRef<HTMLButtonElement | null>(null);

  const cpfLookupRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const session = getOperatorSession();

    if (!session) {
      router.push("/cash-login");
      return;
    }

    setOperatorSession(session);
  }, [router]);

  useEffect(() => {
    const unsubProducts = onSnapshot(query(collection(db, "products")), (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Product),
      }));
      setProducts(list.filter((item) => item.active));
    });

    const unsubCustomers = onSnapshot(query(collection(db, "customers")), (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Customer),
      }));
      setCustomers(list.filter((item) => item.active));
    });

    const unsubSales = onSnapshot(query(collection(db, "sales")), (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Sale),
      }));
      setSales(list.reverse().slice(0, 100));
    });

    async function loadSettings() {
      const q = query(collection(db, "settings"));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        setCompany(snapshot.docs[0].data() as CompanySettings);
      }
    }

    loadSettings();

    return () => {
      unsubProducts();
      unsubCustomers();
      unsubSales();
    };
  }, []);

  useEffect(() => {
    if (!operatorSession) return;

    const q = query(
      collection(db, "cash_sessions"),
      where("operatorId", "==", operatorSession.operatorId),
      where("status", "==", "open")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setCurrentSession(null);
        setSessionSales([]);
        setMovements([]);
        setShowOpenCashModal(true);
        return;
      }

      const sessionDoc = snapshot.docs[0];
      const session = {
        id: sessionDoc.id,
        ...(sessionDoc.data() as CashSession),
      };

      setCurrentSession(session);
      setShowOpenCashModal(false);
    });

    return () => unsubscribe();
  }, [operatorSession]);

  useEffect(() => {
    if (!currentSession?.id) return;

    const salesQ = query(
      collection(db, "sales"),
      where("operatorId", "==", currentSession.operatorId)
    );

    const movementsQ = query(
      collection(db, "cash_movements"),
      where("sessionId", "==", currentSession.id)
    );

    const unsubSales = onSnapshot(salesQ, (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Sale),
      }));

      const filtered = list.filter(
        (sale) => new Date(sale.createdAt).getTime() >= new Date(currentSession.openedAt).getTime()
      );

      setSessionSales(filtered);
    });

    const unsubMovements = onSnapshot(movementsQ, (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as CashMovement),
      }));
      setMovements(list);
    });

    return () => {
      unsubSales();
      unsubMovements();
    };
  }, [currentSession]);

  useEffect(() => {
    function handleGlobalKeys(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showFinalizeModal) return void setShowFinalizeModal(false);
        if (showCloseCashModal) return void setShowCloseCashModal(false);
        if (showWithdrawalModal) return void setShowWithdrawalModal(false);
        if (showProductConsultModal) return void setShowProductConsultModal(false);
        if (showSalesModal) return void setShowSalesModal(false);
        if (showExitModal) return void setShowExitModal(false);
        if (showRemoveItemModal) return void setShowRemoveItemModal(false);
        if (showCancelCouponModal) return void setShowCancelCouponModal(false);
        if (showCpfModal) {
          setShowCpfModal(false);
          setCustomerId("");
          setIdentifyCustomer(false);
          setCpfLookupMessage("");
          return;
        }
      }

      if (e.key === "F2") {
        e.preventDefault();
        setShowProductConsultModal(true);
      }

      if (e.key === "F3" && currentSession && cart.length > 0) {
        e.preventDefault();
        setShowFinalizeModal(true);
      }

      if (e.key === "F6" && currentSession && cart.length > 0) {
        e.preventDefault();
        setShowCancelCouponModal(true);
      }

      if (e.key === "F8" && currentSession) {
        e.preventDefault();
        setShowWithdrawalModal(true);
      }

      if (e.key === "F9" && currentSession) {
        e.preventDefault();
        setShowCloseCashModal(true);
      }
    }

    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, [
    currentSession,
    cart.length,
    showFinalizeModal,
    showCloseCashModal,
    showWithdrawalModal,
    showProductConsultModal,
    showSalesModal,
    showExitModal,
    showRemoveItemModal,
    showCancelCouponModal,
    showCpfModal,
  ]);

  useEffect(() => {
    if (showOpenCashModal) {
      setTimeout(() => openCashAmountRef.current?.focus(), 80);
    }
  }, [showOpenCashModal]);

  useEffect(() => {
    if (showWithdrawalModal) {
      setTimeout(() => withdrawalAmountRef.current?.focus(), 80);
    }
  }, [showWithdrawalModal]);

  useEffect(() => {
    if (showFinalizeModal) {
      setTimeout(() => finalizePaymentRef.current?.focus(), 80);
    }
  }, [showFinalizeModal]);

  useEffect(() => {
    if (showCpfModal) {
      setTimeout(() => cpfLookupRef.current?.focus(), 80);
    }
  }, [showCpfModal]);

  const selectedCustomer = customers.find((item) => item.id === customerId);

  const suggestions = useMemo(() => {
    const term = productSearch.toLowerCase().trim();

    if (term.length < 3) return [];

    return products
      .filter((product) => {
        return (
          product.name.toLowerCase().includes(term) ||
          product.internalCode.toLowerCase().includes(term) ||
          (product.eanCode || "").toLowerCase().includes(term)
        );
      })
      .slice(0, 8);
  }, [productSearch, products]);

  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [productSearch]);

  const consultProducts = useMemo(() => {
    const term = consultFilter.toLowerCase().trim();

    if (!term) return products;

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(term) ||
        product.internalCode.toLowerCase().includes(term) ||
        (product.eanCode || "").toLowerCase().includes(term)
      );
    });
  }, [consultFilter, products]);

  const defaultUnitPrice = useMemo(() => {
    if (!selectedProduct) return 0;

    return paymentMethod === "cash" || paymentMethod === "pix"
      ? selectedProduct.priceCash
      : selectedProduct.priceCard;
  }, [selectedProduct, paymentMethod]);

  const canEditUnitPrice = paymentMethod === "cash" || paymentMethod === "pix";

  useEffect(() => {
    if (!selectedProduct) {
      setManualUnitPriceInput("");
      return;
    }

    setManualUnitPriceInput(String(defaultUnitPrice).replace(".", ","));
  }, [selectedProduct, defaultUnitPrice]);

  const unitPrice = useMemo(() => {
    if (!selectedProduct) return 0;

    if (!canEditUnitPrice) return defaultUnitPrice;

    const parsed = Number(manualUnitPriceInput.replace(",", "."));
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [selectedProduct, canEditUnitPrice, defaultUnitPrice, manualUnitPriceInput]);

  const quantityValue = useMemo(() => {
    const parsed = Number(quantityInput.replace(",", "."));
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [quantityInput]);

  const currentItemTotal = useMemo(() => {
    return unitPrice * quantityValue;
  }, [unitPrice, quantityValue]);

  const totalGeneral = calculateCartTotal(cart, paymentMethod);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const caixaStatus = cart.length > 0 ? "CAIXA EM OPERAÇÃO" : "CAIXA LIVRE";

  const amountReceived = useMemo(() => {
    const parsed = Number(amountReceivedInput.replace(/\./g, "").replace(",", "."));
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [amountReceivedInput]);

  const changeAmount = useMemo(() => {
    if (paymentMethod !== "cash") return 0;
    const change = amountReceived - totalGeneral;
    return change > 0 ? change : 0;
  }, [amountReceived, totalGeneral, paymentMethod]);

  const closureReport = useMemo(() => {
    if (!currentSession) return null;

    return calculateCashClosureReport({
      session: currentSession,
      sales: sessionSales,
      movements,
      trayAmount: parseMoney(trayAmountInput),
    });
  }, [currentSession, sessionSales, movements, trayAmountInput]);

  useEffect(() => {
    if (!closureReport || withdrawalAlertShown) return;

    if (closureReport.expectedCashAmount >= WITHDRAWAL_ALERT_LIMIT) {
      setWithdrawalAlertShown(true);
      alert(
        `Atenção: o caixa atingiu ${money(
          closureReport.expectedCashAmount
        )} em dinheiro. Recomenda-se realizar retirada.`
      );
    }
  }, [closureReport, withdrawalAlertShown]);

  function formatMoneyRawInput(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "0,00";
    const numberValue = Number(digits) / 100;
    return numberValue.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function parseMoney(value: string) {
    const parsed = Number(value.replace(/\./g, "").replace(",", "."));
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function openPrintTab(path: string) {
    window.open(path, "_blank", "noopener,noreferrer");
  }

  async function handleCpfLookup() {
    const cpfDigits = onlyDigits(cpfLookupInput);

    if (!cpfDigits) {
      setCustomerId("");
      setIdentifyCustomer(false);
      setCpfLookupMessage("Venda sem cliente identificado.");
      setShowCpfModal(false);
      setTimeout(() => searchInputRef.current?.focus(), 80);
      return;
    }

    if (cpfDigits.length !== 11) {
      setCpfLookupMessage("CPF deve ter 11 dígitos.");
      return;
    }

    const foundCustomer = customers.find((customer) => onlyDigits(customer.cpf || "") === cpfDigits);

    if (foundCustomer) {
      setCustomerId(foundCustomer.id || "");
      setIdentifyCustomer(true);
      setCpfLookupMessage(`Cliente localizado: ${foundCustomer.name}`);
    } else {
      setCustomerId("");
      setIdentifyCustomer(false);
      setCpfLookupMessage("CPF não encontrado. Compra seguirá sem cadastro.");
    }

    setShowCpfModal(false);
    setTimeout(() => searchInputRef.current?.focus(), 80);
  }

  function startNewSale() {
    setCpfLookupInput("");
    setCpfLookupMessage("");
    setShowCpfModal(true);
    setCurrentOperationId(createOperationId());
  }

  function selectProduct(product: Product) {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setTimeout(() => quantityInputRef.current?.focus(), 50);
  }

  function resetCurrentItem() {
    setSelectedProduct(null);
    setProductSearch("");
    setQuantityInput("1");
    setManualUnitPriceInput("");
    setSelectedSuggestionIndex(0);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  function addSelectedProduct() {
    if (!currentSession) {
      alert("Abra o caixa antes de vender.");
      return;
    }

    if (!selectedProduct) {
      alert("Selecione um produto.");
      return;
    }

    if (quantityValue <= 0) {
      alert("Informe uma quantidade válida.");
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        productId: selectedProduct.id!,
        productName: selectedProduct.name,
        internalCode: selectedProduct.internalCode,
        eanCode: selectedProduct.eanCode,
        unitType: selectedProduct.unitType,
        quantity: quantityValue,
        unitPriceCash: canEditUnitPrice ? unitPrice : selectedProduct.priceCash,
        unitPriceCard: selectedProduct.priceCard,
      },
    ]);

    resetCurrentItem();
  }

  function askRemoveCartItem(index: number) {
    setRemoveItemIndex(index);
    setRemoveItemReason("");
    setShowRemoveItemModal(true);
  }

  async function confirmRemoveCartItem() {
    if (removeItemIndex === null || !operatorSession) return;

    const item = cart[removeItemIndex];
    if (!item) return;

    if (!removeItemReason.trim()) {
      alert("Informe o motivo da remoção do item.");
      return;
    }

    const unitPrice = getUnitPriceByPayment(item, paymentMethod);

    const payload: CanceledItem = {
      operationId: currentOperationId,
      operatorId: operatorSession.operatorId,
      operatorName: operatorSession.operatorName,
      customerId: identifyCustomer ? customerId : "",
      customerName: identifyCustomer ? selectedCustomer?.name || "" : "",
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice,
      totalPrice: unitPrice * item.quantity,
      internalCode: item.internalCode,
      eanCode: item.eanCode,
      unitType: item.unitType,
      reason: removeItemReason.trim(),
      createdAt: nowIso(),
    };

    await addDoc(collection(db, "canceled_items"), payload);

    setCart((prev) => prev.filter((_, i) => i !== removeItemIndex));
    setShowRemoveItemModal(false);
    setRemoveItemIndex(null);
    setRemoveItemReason("");
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  async function confirmCancelCoupon() {
    if (!operatorSession) return;

    if (!cart.length) {
      alert("Não há cupom em aberto para cancelar.");
      return;
    }

    if (!cancelCouponReason.trim()) {
      alert("Informe o motivo do cancelamento do cupom.");
      return;
    }

    const items = cart.map((item) => {
      const unitPrice = getUnitPriceByPayment(item, paymentMethod);
      return {
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
        internalCode: item.internalCode,
        eanCode: item.eanCode,
        unitType: item.unitType,
      };
    });

    const payload: CanceledCoupon = {
      operationId: currentOperationId,
      operatorId: operatorSession.operatorId,
      operatorName: operatorSession.operatorName,
      customerId: identifyCustomer ? customerId : "",
      customerName: identifyCustomer ? selectedCustomer?.name || "" : "",
      reason: cancelCouponReason.trim(),
      total: items.reduce((sum, item) => sum + item.totalPrice, 0),
      items,
      createdAt: nowIso(),
    };

    await addDoc(collection(db, "canceled_coupons"), payload);

    setCart([]);
    setCancelCouponReason("");
    setShowCancelCouponModal(false);
    setCustomerId("");
    setIdentifyCustomer(false);
    startNewSale();
  }

  async function handleOpenCash() {
    if (!operatorSession) return;

    try {
      const openingAmount = parseMoney(openingAmountInput);

      const newSession: Omit<CashSession, "id"> = {
        operatorId: operatorSession.operatorId,
        operatorName: operatorSession.operatorName,
        openedAt: nowIso(),
        openingAmount,
        status: "open",
        closedAt: null,
      };

      const sessionRef = await addDoc(collection(db, "cash_sessions"), newSession);

      await addDoc(collection(db, "cash_movements"), {
        sessionId: sessionRef.id,
        operatorId: operatorSession.operatorId,
        operatorName: operatorSession.operatorName,
        type: "opening",
        amount: openingAmount,
        reason: "Abertura de caixa",
        createdAt: nowIso(),
      });

      setOpeningAmountInput("0,00");
      setWithdrawalAlertShown(false);
      setShowOpenCashModal(false);
      startNewSale();
    } catch (error) {
      console.error(error);
      alert("Erro ao abrir o caixa.");
    }
  }

  async function handleWithdrawal() {
    if (!currentSession || !operatorSession || !closureReport) return;

    try {
      const amount = parseMoney(withdrawalAmountInput);

      if (amount <= 0) {
        alert("Informe um valor válido para retirada.");
        return;
      }

      if (amount > closureReport.expectedCashAmount) {
        alert("O valor da retirada é maior que o dinheiro disponível no caixa.");
        return;
      }

      const movement = {
        sessionId: currentSession.id,
        operatorId: operatorSession.operatorId,
        operatorName: operatorSession.operatorName,
        type: "withdrawal" as const,
        amount,
        reason: withdrawalReason.trim() || "Retirada de caixa",
        createdAt: nowIso(),
      };

      const movementRef = await addDoc(collection(db, "cash_movements"), movement);

      const shouldPrint = window.confirm("Deseja imprimir o comprovante de retirada?");

      if (shouldPrint) {
        const encoded = encodeURIComponent(JSON.stringify({ ...movement, id: movementRef.id }));
        openPrintTab(`/print-withdrawal?data=${encoded}&back=/checkout`);
      }

      setWithdrawalAmountInput("0,00");
      setWithdrawalReason("");
      setShowWithdrawalModal(false);
      setWithdrawalAlertShown(false);
      alert("Retirada registrada com sucesso.");
      setTimeout(() => searchInputRef.current?.focus(), 80);
    } catch (error) {
      console.error(error);
      alert("Erro ao registrar retirada.");
    }
  }

  async function handleCloseCash() {
    if (!currentSession || !closureReport) return;

    try {
      await updateDoc(doc(db, "cash_sessions", currentSession.id!), {
        status: "closed",
        closedAt: nowIso(),
        closingNotes: closingNotes.trim(),
        expectedCashAmount: closureReport.expectedCashAmount,
        totalSalesCash: closureReport.totalSalesCash,
        totalSalesPix: closureReport.totalSalesPix,
        totalSalesCard: closureReport.totalSalesCard,
        totalSalesFiado: closureReport.totalSalesFiado,
        totalWithdrawals: closureReport.totalWithdrawals,
        trayAmount: closureReport.trayAmount ?? null,
        differenceAmount: closureReport.differenceAmount ?? null,
        differenceType: closureReport.differenceType ?? null,
      });

      const reportData = {
        operatorName: currentSession.operatorName,
        openedAt: currentSession.openedAt,
        closedAt: nowIso(),
        openingAmount: closureReport.openingAmount,
        totalSalesCash: closureReport.totalSalesCash,
        totalSalesPix: closureReport.totalSalesPix,
        totalSalesCard: closureReport.totalSalesCard,
        totalSalesFiado: closureReport.totalSalesFiado,
        totalWithdrawals: closureReport.totalWithdrawals,
        expectedCashAmount: closureReport.expectedCashAmount,
        trayAmount: closureReport.trayAmount ?? 0,
        differenceAmount: closureReport.differenceAmount ?? 0,
        differenceType: closureReport.differenceType ?? "matched",
        closingNotes: closingNotes.trim(),
      };

      setClosingNotes("");
      setTrayAmountInput("0,00");
      setShowCloseCashModal(false);
      setCart([]);
      setCustomerId("");
      setIdentifyCustomer(false);

      if (closeAndPrint) {
        const encoded = encodeURIComponent(JSON.stringify(reportData));
        openPrintTab(`/print-cash-close?data=${encoded}&back=/checkout`);
      }

      alert("Caixa fechado com sucesso.");
    } catch (error) {
      console.error(error);
      alert("Erro ao fechar o caixa.");
    }
  }

  async function confirmFinalizeSale() {
    if (!operatorSession || !currentSession) {
      alert("Abra o caixa antes de vender.");
      return;
    }

    if (!cart.length) {
      alert("Nenhum item lançado.");
      return;
    }

    if (identifyCustomer && paymentMethod === "fiado" && !selectedCustomer) {
      alert("Selecione um cliente para venda fiado.");
      return;
    }

    if (paymentMethod === "fiado" && !identifyCustomer) {
      alert("Venda fiado precisa ser identificada com cliente.");
      return;
    }

    if (paymentMethod === "fiado" && selectedCustomer?.blocked) {
      alert("Este cliente está bloqueado para compras fiado.");
      return;
    }

    if (paymentMethod === "fiado" && selectedCustomer) {
      const availableCredit = Number(selectedCustomer.availableCredit || 0);

      if (totalGeneral > availableCredit) {
        alert("Saldo disponível insuficiente para esta venda fiado.");
        return;
      }
    }

    if (paymentMethod === "cash" && amountReceived < totalGeneral) {
      alert("O valor recebido é menor que o total da venda.");
      return;
    }

    if (paymentMethod === "card" && !cardType) {
      alert("Selecione débito ou crédito.");
      return;
    }

    const remainingCustomerCredit =
      paymentMethod === "fiado" && selectedCustomer
        ? Number(selectedCustomer.availableCredit || 0) - totalGeneral
        : null;

    const sale: Sale = {
      saleNumber: generateSaleNumber(),
      customerId: identifyCustomer ? selectedCustomer?.id || "" : "",
      customerName: identifyCustomer ? selectedCustomer?.name || "" : "",
      operatorId: operatorSession.operatorId,
      operatorName: operatorSession.operatorName,
      paymentMethod,
      priceMode: paymentMethod === "cash" || paymentMethod === "pix" ? "cash" : "card",
      subtotal: totalGeneral,
      total: totalGeneral,
      createdAt: nowIso(),
      remainingCustomerCredit,
      cardType: paymentMethod === "card" ? cardType : "",
      amountReceived: paymentMethod === "cash" ? amountReceived : null,
      changeAmount: paymentMethod === "cash" ? changeAmount : null,
      items: cart.map((item) => {
        const price = getUnitPriceByPayment(item, paymentMethod);
        return {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: price,
          totalPrice: price * item.quantity,
          internalCode: item.internalCode,
          eanCode: item.eanCode,
          unitType: item.unitType,
        };
      }),
    };

    try {
      const saleRef = await addDoc(collection(db, "sales"), sale);

      if (paymentMethod === "fiado" && selectedCustomer?.id) {
        await addDoc(collection(db, "receivables"), {
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          saleId: saleRef.id,
          amount: totalGeneral,
          remainingAmount: totalGeneral,
          status: "open",
          createdAt: nowIso(),
        });

        await updateDoc(doc(db, "customers", selectedCustomer.id), {
          availableCredit: remainingCustomerCredit,
        });
      }

      const encoded = encodeURIComponent(JSON.stringify({ ...sale, id: saleRef.id }));
      const shouldPrint = window.confirm("Deseja imprimir o cupom?");

      setCart([]);
      setPaymentMethod("cash");
      setCardType("");
      setAmountReceivedInput("0,00");
      resetCurrentItem();
      setShowFinalizeModal(false);

      if (shouldPrint) {
        openPrintTab(`/print-receipt?data=${encoded}&back=/checkout`);
      }

      startNewSale();
    } catch (error) {
      console.error(error);
      alert("Erro ao finalizar venda.");
    }
  }

  function handleReprint(sale: Sale) {
    const encoded = encodeURIComponent(JSON.stringify(sale));
    openPrintTab(`/print-receipt?data=${encoded}&back=/checkout`);
  }

  async function handleExitCash() {
    if (!operatorSession) return;

    try {
      const q = query(
        collection(db, "operators"),
        where("username", "==", exitUsername.trim().toLowerCase())
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert("Usuário não encontrado.");
        return;
      }

      const operator = snapshot.docs[0].data() as Operator;

      if (operator.password !== exitPassword.trim()) {
        alert("Senha inválida.");
        return;
      }

      clearOperatorSession();
      router.push("/cash-login");
    } catch (error) {
      console.error(error);
      alert("Erro ao sair do caixa.");
    }
  }

  if (!operatorSession) return null;

  return (
    <main className="pdv-screen">
      <div className="pdv-top-banner">{caixaStatus}</div>

      <div className="pdv-main-layout">
        <section className="pdv-left-panel">
          <div className="pdv-input-block">
            <label>Código / código de barras / produto</label>
            <input
              ref={searchInputRef}
              className="pdv-input"
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                if (e.target.value.trim().length < 3) setSelectedProduct(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && suggestions.length > 0 && !selectedProduct) {
                  e.preventDefault();
                  setSelectedSuggestionIndex((prev) =>
                    prev + 1 >= suggestions.length ? prev : prev + 1
                  );
                }

                if (e.key === "ArrowUp" && suggestions.length > 0 && !selectedProduct) {
                  e.preventDefault();
                  setSelectedSuggestionIndex((prev) => (prev - 1 < 0 ? 0 : prev - 1));
                }

                if (e.key === "Enter") {
                  e.preventDefault();

                  if (!selectedProduct && suggestions.length > 0) {
                    selectProduct(suggestions[selectedSuggestionIndex]);
                    return;
                  }

                  if (selectedProduct) {
                    quantityInputRef.current?.focus();
                  }
                }
              }}
              placeholder="Digite ou bip o produto"
              autoFocus
              disabled={!currentSession || showCpfModal}
            />

            {suggestions.length > 0 && !selectedProduct ? (
              <div className="pdv-suggestions">
                {suggestions.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    className={`pdv-suggestion-item ${index === selectedSuggestionIndex ? "active" : ""}`}
                    onClick={() => selectProduct(product)}
                  >
                    <strong>{product.name}</strong>
                    <span>
                      {product.internalCode} {product.eanCode ? `| ${product.eanCode}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="pdv-input-block">
            <label>Quantidade</label>
            <input
              ref={quantityInputRef}
              className="pdv-input pdv-number"
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value.replace(/[^0-9,.\-]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();

                  if (canEditUnitPrice) {
                    unitPriceInputRef.current?.focus();
                  } else {
                    addSelectedProduct();
                  }
                }
              }}
              placeholder="0,01"
              disabled={!currentSession || showCpfModal}
            />
          </div>

          <div className="pdv-input-block">
            <label>Preço unitário</label>
            <input
              ref={unitPriceInputRef}
              className="pdv-input pdv-number"
              value={manualUnitPriceInput}
              onChange={(e) => {
                if (!canEditUnitPrice) return;
                setManualUnitPriceInput(e.target.value.replace(/[^0-9,.\-]/g, ""));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSelectedProduct();
                }
              }}
              readOnly={!canEditUnitPrice}
              disabled={!currentSession || showCpfModal}
            />
          </div>

          <div className="pdv-readonly-block">
            <label>Preço total</label>
            <div className="pdv-readonly">{money(currentItemTotal)}</div>
          </div>

          <div className="pdv-left-logo-box">
            {company?.logoUrl ? (
              <img src={company.logoUrl} alt="Logo" className="pdv-logo" />
            ) : (
              <div className="pdv-logo-placeholder">LOGO</div>
            )}
          </div>
        </section>

        <section className="pdv-center-panel">
          <div className="pdv-items-table-wrap">
            <table className="pdv-items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qtd</th>
                  <th>Unit.</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, index) => {
                  const price = getUnitPriceByPayment(item, paymentMethod);
                  const total = price * item.quantity;

                  return (
                    <tr key={`${item.productId}-${index}`}>
                      <td>
                        <strong>{item.productName}</strong>
                        <div className="muted">
                          {item.internalCode} {item.eanCode ? `| ${item.eanCode}` : ""}
                        </div>
                      </td>
                      <td>{item.quantity.toFixed(3)}</td>
                      <td>{money(price)}</td>
                      <td>{money(total)}</td>
                      <td>
                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => askRemoveCartItem(index)}
                        >
                          X
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!cart.length ? (
                  <tr>
                    <td colSpan={5} className="pdv-empty-table">
                      Nenhum item lançado
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="pdv-footer-summary">
            <div className="pdv-summary-label">
              <span>Total Geral</span>
              <span>Itens {itemCount.toFixed(3)}</span>
            </div>

            <div className="pdv-total-highlight">{money(totalGeneral)}</div>
          </div>
        </section>

        <aside className="pdv-right-panel">
          <div className="pdv-operator-mini">
            <span className="pdv-operator-mini-label">Operador</span>
            <strong className="pdv-operator-mini-name">{operatorSession.operatorName}</strong>
          </div>

          {identifyCustomer && selectedCustomer ? (
            <div className="pdv-cpf-client-box">
              <span className="pdv-cpf-client-label">CPF identificado</span>
              <strong>{selectedCustomer.name}</strong>
              <span>{selectedCustomer.cpf || ""}</span>
            </div>
          ) : (
            <div className="pdv-cpf-client-box">
              <span className="pdv-cpf-client-label">CPF na compra</span>
              <strong>Sem cliente identificado</strong>
            </div>
          )}

          <div className="pdv-shortcuts-list">
            <div className="pdv-shortcut-item">
              <strong>F2</strong>
              <span>Consulta produtos</span>
            </div>
            <div className="pdv-shortcut-item">
              <strong>F3</strong>
              <span>Finalizar venda</span>
            </div>
            <div className="pdv-shortcut-item">
              <strong>F6</strong>
              <span>Cancelar cupom</span>
            </div>
            <div className="pdv-shortcut-item">
              <strong>F8</strong>
              <span>Retirada</span>
            </div>
            <div className="pdv-shortcut-item">
              <strong>F9</strong>
              <span>Fechamento</span>
            </div>
            <div className="pdv-shortcut-item">
              <strong>ESC</strong>
              <span>Fechar janela</span>
            </div>
          </div>
        </aside>
      </div>

      {showCpfModal ? (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal pdv-exit-modal">
            <div className="pdv-modal-header">
              <h3>CPF na compra</h3>
            </div>

            <div className="grid">
              <div>
                <label>Digite o CPF ou pressione Enter para seguir sem CPF</label>
                <input
                  ref={cpfLookupRef}
                  className="input"
                  value={cpfLookupInput}
                  onChange={(e) => setCpfLookupInput(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCpfLookup();
                    }
                  }}
                />
              </div>

              {cpfLookupMessage ? <div className="muted">{cpfLookupMessage}</div> : null}

              <button className="btn btn-primary btn-full" onClick={handleCpfLookup}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showRemoveItemModal ? (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal pdv-exit-modal">
            <div className="pdv-modal-header">
              <h3>Cancelar item</h3>
              <button className="btn btn-outline" onClick={() => setShowRemoveItemModal(false)}>
                Fechar
              </button>
            </div>

            <div className="grid">
              <div>
                <label>Motivo da remoção do item</label>
                <input
                  className="input"
                  value={removeItemReason}
                  onChange={(e) => setRemoveItemReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmRemoveCartItem();
                    }
                  }}
                />
              </div>

              <button className="btn btn-danger btn-full" onClick={confirmRemoveCartItem}>
                Confirmar remoção
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCancelCouponModal ? (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal pdv-exit-modal">
            <div className="pdv-modal-header">
              <h3>Cancelar cupom</h3>
              <button className="btn btn-outline" onClick={() => setShowCancelCouponModal(false)}>
                Fechar
              </button>
            </div>

            <div className="grid">
              <div>
                <label>Motivo do cancelamento</label>
                <input
                  className="input"
                  value={cancelCouponReason}
                  onChange={(e) => setCancelCouponReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmCancelCoupon();
                    }
                  }}
                />
              </div>

              <button className="btn btn-danger btn-full" onClick={confirmCancelCoupon}>
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showFinalizeModal ? (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal pdv-finalize-modal">
            <div className="pdv-modal-header">
              <h3>Finalizar venda</h3>
              <button className="btn btn-outline" onClick={() => setShowFinalizeModal(false)}>
                Fechar
              </button>
            </div>

            <div className="grid grid-2">
              <div>
                <label>Forma de pagamento</label>
                <select
                  ref={finalizePaymentRef}
                  className="select"
                  value={paymentMethod}
                  onChange={(e) => {
                    const value = e.target.value as PaymentMethod;
                    setPaymentMethod(value);
                    if (value !== "card") setCardType("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();

                      if (paymentMethod === "cash") {
                        finalizeAmountReceivedRef.current?.focus();
                        return;
                      }

                      if (paymentMethod === "card") {
                        finalizeCardTypeRef.current?.focus();
                        return;
                      }

                      finalizeConfirmButtonRef.current?.focus();
                    }
                  }}
                >
                  <option value="cash">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="card">Cartão</option>
                  <option value="fiado">Fiado</option>
                </select>
              </div>

              <div>
                <label>Cliente da compra</label>
                <div className="pdv-readonly-modal small">
                  {identifyCustomer && selectedCustomer
                    ? selectedCustomer.name
                    : "Sem cliente identificado"}
                </div>
              </div>
            </div>

            {paymentMethod === "cash" ? (
              <div className="grid grid-2" style={{ marginTop: 12 }}>
                <div>
                  <label>Valor recebido</label>
                  <input
                    ref={finalizeAmountReceivedRef}
                    className="input"
                    value={amountReceivedInput}
                    onChange={(e) => setAmountReceivedInput(formatMoneyRawInput(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        finalizeConfirmButtonRef.current?.focus();
                      }
                    }}
                  />
                </div>

                <div>
                  <label>Troco</label>
                  <div className="pdv-readonly-modal">{money(changeAmount)}</div>
                </div>
              </div>
            ) : null}

            {paymentMethod === "card" ? (
              <div style={{ marginTop: 12 }}>
                <label>Tipo do cartão</label>
                <select
                  ref={finalizeCardTypeRef}
                  className="select"
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value as "debit" | "credit" | "")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      finalizeConfirmButtonRef.current?.focus();
                    }
                  }}
                >
                  <option value="">Selecione</option>
                  <option value="debit">Débito</option>
                  <option value="credit">Crédito</option>
                </select>
              </div>
            ) : null}

            {paymentMethod === "fiado" && identifyCustomer && selectedCustomer ? (
              <div className="pdv-customer-mini" style={{ marginTop: 12 }}>
                <div><strong>Saldo disponível:</strong> {money(selectedCustomer.availableCredit || 0)}</div>
                <div><strong>Status:</strong> {selectedCustomer.blocked ? "Bloqueado" : "Ativo"}</div>
              </div>
            ) : null}

            <div className="pdv-finalize-total">
              <span>Total da venda</span>
              <strong>{money(totalGeneral)}</strong>
            </div>

            <div className="row" style={{ marginTop: 16 }}>
              <button
                ref={finalizeConfirmButtonRef}
                className="btn btn-secondary"
                onClick={confirmFinalizeSale}
              >
                Confirmar venda
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showOpenCashModal ? (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal pdv-exit-modal">
            <div className="pdv-modal-header">
              <h3>Abertura de caixa</h3>
            </div>

            <div className="grid">
              <div>
                <label>Valor inicial em caixa</label>
                <input
                  ref={openCashAmountRef}
                  className="input"
                  value={openingAmountInput}
                  onChange={(e) => setOpeningAmountInput(formatMoneyRawInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      openCashConfirmRef.current?.focus();
                    }
                  }}
                />
              </div>

              <button
                ref={openCashConfirmRef}
                className="btn btn-primary btn-full"
                onClick={handleOpenCash}
              >
                Abrir caixa
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showWithdrawalModal ? (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal pdv-exit-modal">
            <div className="pdv-modal-header">
              <h3>Retirada / sangria</h3>
              <button className="btn btn-outline" onClick={() => setShowWithdrawalModal(false)}>
                Fechar
              </button>
            </div>

            <div className="grid">
              <div>
                <label>Valor da retirada</label>
                <input
                  ref={withdrawalAmountRef}
                  className="input"
                  value={withdrawalAmountInput}
                  onChange={(e) => setWithdrawalAmountInput(formatMoneyRawInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      withdrawalReasonRef.current?.focus();
                    }
                  }}
                />
              </div>

              <div>
                <label>Motivo</label>
                <input
                  ref={withdrawalReasonRef}
                  className="input"
                  value={withdrawalReason}
                  onChange={(e) => setWithdrawalReason(e.target.value)}
                  placeholder="Ex.: Sangria de caixa"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      withdrawalConfirmRef.current?.focus();
                    }
                  }}
                />
              </div>

              <button
                ref={withdrawalConfirmRef}
                className="btn btn-warning btn-full"
                onClick={handleWithdrawal}
              >
                Confirmar retirada
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCloseCashModal && closureReport ? (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal">
            <div className="pdv-modal-header">
              <h3>Fechamento de caixa</h3>
              <button className="btn btn-outline" onClick={() => setShowCloseCashModal(false)}>
                Fechar
              </button>
            </div>

            <div className="cash-report-grid">
              <div className="cash-report-item">
                <span>Saldo inicial de abertura</span>
                <strong>{money(closureReport.openingAmount)}</strong>
              </div>

              <div className="cash-report-item">
                <span>Vendas em dinheiro</span>
                <strong>{money(closureReport.totalSalesCash)}</strong>
              </div>

              <div className="cash-report-item">
                <span>Vendas no PIX</span>
                <strong>{money(closureReport.totalSalesPix)}</strong>
              </div>

              <div className="cash-report-item">
                <span>Vendas em cartão</span>
                <strong>{money(closureReport.totalSalesCard)}</strong>
              </div>

              <div className="cash-report-item">
                <span>Vendas fiado</span>
                <strong>{money(closureReport.totalSalesFiado)}</strong>
              </div>

              <div className="cash-report-item">
                <span>Retiradas</span>
                <strong>{money(closureReport.totalWithdrawals)}</strong>
              </div>

              <div className="cash-report-item highlight">
                <span>Dinheiro esperado no caixa</span>
                <strong>{money(closureReport.expectedCashAmount)}</strong>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label>Dinheiro na bandeja</label>
              <input
                className="input"
                value={trayAmountInput}
                onChange={(e) => setTrayAmountInput(formatMoneyRawInput(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const next = document.getElementById("closingNotesField") as HTMLTextAreaElement | null;
                    next?.focus();
                  }
                }}
              />
            </div>

            <div className="cash-check-result">
              {closureReport.differenceType === "matched" ? (
                <div className="cash-check-badge ok">Caixa conferido. Sem diferença.</div>
              ) : null}

              {closureReport.differenceType === "short" ? (
                <div className="cash-check-badge short">
                  Está faltando {money(Math.abs(closureReport.differenceAmount || 0))}
                </div>
              ) : null}

              {closureReport.differenceType === "over" ? (
                <div className="cash-check-badge over">
                  Está sobrando {money(closureReport.differenceAmount || 0)}
                </div>
              ) : null}
            </div>

            <div style={{ marginTop: 16 }}>
              <label>Observações do fechamento</label>
              <textarea
                id="closingNotesField"
                className="input"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                rows={4}
                placeholder="Observações para conferência"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleCloseCash();
                  }
                }}
              />
            </div>

            <div className="row" style={{ marginTop: 16 }}>
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={closeAndPrint}
                  onChange={(e) => setCloseAndPrint(e.target.checked)}
                />
                Imprimir relatório de fechamento
              </label>
            </div>

            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn btn-danger" onClick={handleCloseCash}>
                Confirmar fechamento
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSalesModal ? (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal">
            <div className="pdv-modal-header">
              <h3>Vendas passadas</h3>
              <button className="btn btn-outline" onClick={() => setShowSalesModal(false)}>
                Fechar
              </button>
            </div>

            <div className="table-wrap">
              <table className="table modern-table">
                <thead>
                  <tr>
                    <th>Venda</th>
                    <th>Cliente</th>
                    <th>Pagamento</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.saleNumber}</td>
                      <td>{sale.customerName || "Consumidor"}</td>
                      <td>{sale.paymentMethod}</td>
                      <td>{money(sale.total)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-edit"
                          onClick={() => handleReprint(sale)}
                        >
                          Reimprimir
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!sales.length ? (
                    <tr>
                      <td colSpan={5}>Nenhuma venda encontrada.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {showProductConsultModal ? (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal">
            <div className="pdv-modal-header">
              <h3>Consulta de produtos</h3>
              <button className="btn btn-outline" onClick={() => setShowProductConsultModal(false)}>
                Fechar
              </button>
            </div>

            <div className="grid" style={{ marginBottom: 14 }}>
              <div>
                <label>Filtrar produto</label>
                <input
                  className="input"
                  value={consultFilter}
                  onChange={(e) => setConsultFilter(e.target.value)}
                  placeholder="Digite nome, código interno ou EAN"
                />
              </div>
            </div>

            <div className="table-wrap">
              <table className="table modern-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Cód. interno</th>
                    <th>EAN</th>
                    <th>Dinheiro</th>
                    <th>Cartão</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {consultProducts.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.internalCode}</td>
                      <td>{product.eanCode || "-"}</td>
                      <td>{money(product.priceCash)}</td>
                      <td>{money(product.priceCard)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-edit"
                          onClick={() => {
                            selectProduct(product);
                            setShowProductConsultModal(false);
                          }}
                        >
                          Selecionar
                        </button>
                      </td>
                    </tr>
                  ))}

                  {!consultProducts.length ? (
                    <tr>
                      <td colSpan={6}>Nenhum produto encontrado.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {showExitModal ? (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal pdv-exit-modal">
            <div className="pdv-modal-header">
              <h3>Sair do caixa</h3>
              <button className="btn btn-outline" onClick={() => setShowExitModal(false)}>
                Fechar
              </button>
            </div>

            <div className="grid">
              <div>
                <label>Usuário</label>
                <input
                  className="input"
                  value={exitUsername}
                  onChange={(e) => setExitUsername(e.target.value)}
                />
              </div>

              <div>
                <label>Senha</label>
                <input
                  className="input"
                  type="password"
                  value={exitPassword}
                  onChange={(e) => setExitPassword(e.target.value)}
                />
              </div>

              <button className="btn btn-danger btn-full" onClick={handleExitCash}>
                Confirmar saída
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}