import { Injectable } from "@nestjs/common";
import * as path from "path";
import * as QRCode from "qrcode";
import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";

// pdfmake Node.js usage
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require("pdfmake/js/Printer").default;

const FONTS_DIR = path.join(__dirname, "..", "..", "..", "node_modules", "pdfmake", "build", "fonts");

const fonts = {
  Roboto: {
    normal: path.join(FONTS_DIR, "Roboto", "Roboto-Regular.ttf"),
    bold: path.join(FONTS_DIR, "Roboto", "Roboto-Medium.ttf"),
    italics: path.join(FONTS_DIR, "Roboto", "Roboto-Italic.ttf"),
    bolditalics: path.join(FONTS_DIR, "Roboto", "Roboto-MediumItalic.ttf"),
  },
};

export interface PdfCompanyInfo {
  legalName: string;
  tradeName?: string | null;
  fiscalNumber?: string | null;
  vatNumber?: string | null;
  uinNui?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: {
    street?: string | null;
    city?: string | null;
    municipality?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
}

export interface PdfContactInfo {
  displayName: string;
  legalName?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface PdfLineItem {
  lineNumber: number;
  description?: string | null;
  quantity: string;
  unitPrice: string;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
}

export interface PdfFiscalData {
  fcuin: string;
  verificationUrl?: string | null;
  qrPayload?: string | null;
  fiscalizedAt?: string | null;
  businessUnitCode?: string | null;
  operatorCode?: string | null;
}

export interface PdfDocumentData {
  type: "INVOICE" | "BILL" | "CREDIT_NOTE";
  documentNumber: string | null;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  currency: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount?: string;
  balanceDue?: string;
  notes?: string | null;
  reason?: string | null;
  company: PdfCompanyInfo;
  contact: PdfContactInfo;
  lines: PdfLineItem[];
  creditNoteType?: "SALES" | "PURCHASE";
  fiscal?: PdfFiscalData | null;
}

@Injectable()
export class PdfService {
  private readonly printer: InstanceType<typeof PdfPrinter>;

  constructor() {
    this.printer = new PdfPrinter(fonts);
  }

  async generateDocument(data: PdfDocumentData): Promise<Buffer> {
    const docDefinition = await this.buildDocDefinition(data);
    return this.renderToBuffer(docDefinition);
  }

  private async buildDocDefinition(data: PdfDocumentData): Promise<TDocumentDefinitions> {
    const title = this.getTitle(data);
    const accentColor = data.type === "CREDIT_NOTE" ? "#dc2626" : "#0369a1";

    const fiscalSection = data.fiscal ? await this.buildFiscalSection(data.fiscal) : [];

    return {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 60],
      defaultStyle: { fontSize: 9, font: "Roboto" },
      content: [
        this.buildHeader(data, title, accentColor),
        this.buildParties(data),
        this.buildLinesTable(data),
        this.buildTotals(data),
        ...(data.notes ? [this.buildNotes(data.notes)] : []),
        ...(data.reason ? [this.buildNotes(data.reason, "Reason / Arsyeja")] : []),
        ...fiscalSection,
      ],
      footer: (currentPage: number, pageCount: number) => ({
        text: `${title} ${data.documentNumber ?? "DRAFT"} — Page ${currentPage}/${pageCount}`,
        alignment: "center" as const,
        fontSize: 7,
        color: "#94a3b8",
        margin: [40, 20, 40, 0] as [number, number, number, number],
      }),
    };
  }

  private getTitle(data: PdfDocumentData): string {
    switch (data.type) {
      case "INVOICE":
        return "FATURË / INVOICE";
      case "BILL":
        return "FATURË BLERJE / BILL";
      case "CREDIT_NOTE":
        return data.creditNoteType === "SALES"
          ? "NOTË KREDITORE / CREDIT NOTE"
          : "KREDITË FURNITORI / VENDOR CREDIT";
    }
  }

  private buildHeader(data: PdfDocumentData, title: string, accentColor: string): Content {
    return {
      columns: [
        {
          width: "*",
          stack: [
            { text: data.company.legalName, fontSize: 14, bold: true, color: accentColor },
            ...(data.company.tradeName && data.company.tradeName !== data.company.legalName
              ? [{ text: data.company.tradeName, fontSize: 9, color: "#64748b" }]
              : []),
            ...(data.company.address
              ? [
                  {
                    text: [
                      data.company.address.street,
                      data.company.address.city,
                      data.company.address.municipality,
                      data.company.address.postalCode,
                      data.company.address.country,
                    ]
                      .filter(Boolean)
                      .join(", "),
                    fontSize: 8,
                    color: "#64748b",
                    margin: [0, 2, 0, 0] as [number, number, number, number],
                  },
                ]
              : []),
            ...(data.company.fiscalNumber
              ? [{ text: `Nr. Fiskal: ${data.company.fiscalNumber}`, fontSize: 8, margin: [0, 2, 0, 0] as [number, number, number, number] }]
              : []),
            ...(data.company.vatNumber
              ? [{ text: `TVSH / VAT: ${data.company.vatNumber}`, fontSize: 8 }]
              : []),
            ...(data.company.uinNui
              ? [{ text: `NUI: ${data.company.uinNui}`, fontSize: 8 }]
              : []),
          ],
        },
        {
          width: "auto",
          alignment: "right" as const,
          stack: [
            { text: title, fontSize: 12, bold: true, color: accentColor },
            { text: " ", fontSize: 6 },
            this.infoRow("Nr / No:", data.documentNumber ?? "DRAFT"),
            this.infoRow("Data / Date:", this.formatDate(data.issueDate)),
            ...(data.dueDate
              ? [this.infoRow("Afati / Due:", this.formatDate(data.dueDate))]
              : []),
            this.infoRow("Statusi:", data.status),
            this.infoRow("Monedha / Currency:", data.currency),
          ],
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    };
  }

  private buildParties(data: PdfDocumentData): Content {
    const contactLabel =
      data.type === "BILL"
        ? "FURNITORI / VENDOR"
        : data.type === "CREDIT_NOTE" && data.creditNoteType === "PURCHASE"
          ? "FURNITORI / VENDOR"
          : "KLIENTI / CUSTOMER";

    return {
      columns: [
        {
          width: "*",
          stack: [
            { text: contactLabel, fontSize: 8, bold: true, color: "#64748b", margin: [0, 0, 0, 4] as [number, number, number, number] },
            { text: data.contact.displayName, fontSize: 10, bold: true },
            ...(data.contact.legalName && data.contact.legalName !== data.contact.displayName
              ? [{ text: data.contact.legalName, fontSize: 8, color: "#64748b" }]
              : []),
            ...(data.contact.taxId
              ? [{ text: `Nr. Fiskal: ${data.contact.taxId}`, fontSize: 8 }]
              : []),
            ...([data.contact.street, data.contact.city, data.contact.country]
              .filter(Boolean)
              .length > 0
              ? [
                  {
                    text: [data.contact.street, data.contact.city, data.contact.country]
                      .filter(Boolean)
                      .join(", "),
                    fontSize: 8,
                    color: "#64748b",
                  },
                ]
              : []),
            ...(data.contact.email ? [{ text: data.contact.email, fontSize: 8 }] : []),
          ],
        },
        { width: "*", text: "" },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    };
  }

  private buildLinesTable(data: PdfDocumentData): Content {
    const headerRow: TableCell[] = [
      { text: "#", bold: true, fillColor: "#f1f5f9" },
      { text: "Përshkrimi / Description", bold: true, fillColor: "#f1f5f9" },
      { text: "Sasia / Qty", bold: true, alignment: "right", fillColor: "#f1f5f9" },
      { text: "Çmimi / Price", bold: true, alignment: "right", fillColor: "#f1f5f9" },
      { text: "Neto / Net", bold: true, alignment: "right", fillColor: "#f1f5f9" },
      { text: "TVSH / Tax", bold: true, alignment: "right", fillColor: "#f1f5f9" },
      { text: "Totali / Total", bold: true, alignment: "right", fillColor: "#f1f5f9" },
    ];

    const bodyRows: TableCell[][] = data.lines.map((line) => [
      { text: String(line.lineNumber) },
      { text: line.description ?? "—" },
      { text: this.fmtNum(line.quantity), alignment: "right" },
      { text: this.fmtMoney(line.unitPrice), alignment: "right" },
      { text: this.fmtMoney(line.netAmount), alignment: "right" },
      { text: this.fmtMoney(line.taxAmount), alignment: "right" },
      { text: this.fmtMoney(line.totalAmount), alignment: "right" },
    ]);

    return {
      table: {
        headerRows: 1,
        widths: [20, "*", 45, 60, 60, 50, 65],
        body: [headerRow, ...bodyRows],
      },
      layout: {
        hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
          i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.2,
        vLineWidth: () => 0,
        hLineColor: () => "#cbd5e1",
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 4,
        paddingBottom: () => 4,
      },
      margin: [0, 0, 0, 15] as [number, number, number, number],
    };
  }

  private buildTotals(data: PdfDocumentData): Content {
    const rows: [string, string][] = [
      ["Nën-totali / Subtotal:", this.fmtMoney(data.subtotalAmount)],
      ["TVSH / Tax:", this.fmtMoney(data.taxAmount)],
      ["TOTALI / Total:", this.fmtMoney(data.totalAmount)],
    ];

    if (data.paidAmount && data.balanceDue) {
      rows.push(["Paguar / Paid:", this.fmtMoney(data.paidAmount)]);
      rows.push(["Bilanci / Balance:", this.fmtMoney(data.balanceDue)]);
    }

    return {
      columns: [
        { width: "*", text: "" },
        {
          width: 220,
          table: {
            widths: ["*", 80],
            body: rows.map(([label, value], i) => {
              const isTotal = i === 2;
              return [
                { text: label, bold: isTotal, fontSize: isTotal ? 10 : 9 },
                {
                  text: `${data.currency} ${value}`,
                  alignment: "right",
                  bold: isTotal,
                  fontSize: isTotal ? 10 : 9,
                },
              ];
            }),
          },
          layout: {
            hLineWidth: (i: number) => (i === 3 ? 0.5 : 0),
            vLineWidth: () => 0,
            hLineColor: () => "#cbd5e1",
            paddingTop: () => 3,
            paddingBottom: () => 3,
          },
        },
      ],
      margin: [0, 0, 0, 20] as [number, number, number, number],
    };
  }

  private buildNotes(text: string, label = "Shënime / Notes"): Content {
    return {
      stack: [
        { text: label, fontSize: 8, bold: true, color: "#64748b", margin: [0, 0, 0, 3] as [number, number, number, number] },
        { text, fontSize: 8, color: "#334155" },
      ],
      margin: [0, 0, 0, 10] as [number, number, number, number],
    };
  }

  private async buildFiscalSection(fiscal: PdfFiscalData): Promise<Content[]> {
    const qrSource = fiscal.qrPayload || fiscal.verificationUrl;
    let qrImage: string | null = null;
    if (qrSource) {
      try {
        qrImage = await QRCode.toDataURL(qrSource, { width: 100, margin: 1 });
      } catch {
        // QR generation failed — skip silently
      }
    }

    const infoStack: Content[] = [
      {
        text: "KUPONI FISKAL / FISCAL COUPON",
        fontSize: 9,
        bold: true,
        color: "#166534",
        margin: [0, 0, 0, 4] as [number, number, number, number],
      },
      { text: `NUFK / FCUIN: ${fiscal.fcuin}`, fontSize: 9, bold: true, font: "Roboto" },
    ];

    if (fiscal.businessUnitCode) {
      infoStack.push({ text: `Njësia / Unit: ${fiscal.businessUnitCode}`, fontSize: 8 });
    }
    if (fiscal.operatorCode) {
      infoStack.push({ text: `Operatori: ${fiscal.operatorCode}`, fontSize: 8 });
    }
    if (fiscal.fiscalizedAt) {
      infoStack.push({ text: `Data fiskalizimit: ${this.formatDate(fiscal.fiscalizedAt)}`, fontSize: 8 });
    }
    if (fiscal.verificationUrl) {
      infoStack.push({
        text: fiscal.verificationUrl,
        fontSize: 7,
        color: "#0369a1",
        link: fiscal.verificationUrl,
        margin: [0, 2, 0, 0] as [number, number, number, number],
      });
    }

    const sectionContent: Content = {
      columns: [
        { width: "*", stack: infoStack },
        ...(qrImage
          ? [{ width: 100, image: qrImage, fit: [90, 90] as [number, number] }]
          : []),
      ],
      margin: [0, 10, 0, 0] as [number, number, number, number],
    };

    return [
      {
        canvas: [{ type: "line" as const, x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: "#16a34a" }],
        margin: [0, 5, 0, 5] as [number, number, number, number],
      },
      sectionContent,
    ];
  }

  private infoRow(label: string, value: string): Content {
    return {
      columns: [
        { text: label, width: "auto", fontSize: 8, color: "#64748b" },
        { text: ` ${value}`, width: "auto", fontSize: 9, bold: true },
      ],
      columnGap: 3,
    };
  }

  private formatDate(iso: string): string {
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`;
  }

  private fmtNum(val: string): string {
    const n = Number(val);
    return isNaN(n) ? val : n.toLocaleString("en", { maximumFractionDigits: 2 });
  }

  private fmtMoney(val: string): string {
    const n = Number(val);
    return isNaN(n) ? val : n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private renderToBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = this.printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: Error) => reject(err));
      doc.end();
    });
  }
}
