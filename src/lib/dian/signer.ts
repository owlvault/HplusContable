import crypto from 'crypto';

export interface CufeInput {
    invoiceNumber: string;
    issueDate: string;        // YYYY-MM-DD
    issueTime: string;        // HH:mm:ss-05:00
    subtotal: number;
    ivaAmount: number;        // CodImp1 (01)
    consumptionTax: number;   // CodImp2 (04)
    icaTax: number;           // CodImp3 (03)
    total: number;
    sellerNit: string;
    buyerDocument: string;
    technicalKey: string;
    environment: '1' | '2';   // 1 = Producción, 2 = Pruebas
}

export interface CudeInput {
    documentNumber: string;
    issueDate: string;
    issueTime: string;
    subtotal: number;
    ivaAmount: number;
    consumptionTax: number;
    icaTax: number;
    total: number;
    sellerNit: string;
    buyerDocument: string;
    softwarePin: string;
    environment: '1' | '2';
}

/**
 * Calcula el CUFE legal conforme al Anexo Técnico DIAN 1.9 (Algoritmo SHA-384).
 * Fórmula:
 * CUFE = SHA-384(NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + CodImp2 + ValImp2 + CodImp3 + ValImp3 + ValTot + NitOfe + NumAdq + ClTec + TipoAmb)
 */
export function generateCufe(input: CufeInput): string {
    const valFac = input.subtotal.toFixed(2);
    const codImp1 = '01'; // IVA
    const valImp1 = input.ivaAmount.toFixed(2);
    const codImp2 = '04'; // Impuesto Nacional al Consumo
    const valImp2 = input.consumptionTax.toFixed(2);
    const codImp3 = '03'; // ICA
    const valImp3 = input.icaTax.toFixed(2);
    const valTot = input.total.toFixed(2);

    const rawString = [
        input.invoiceNumber,
        input.issueDate,
        input.issueTime,
        valFac,
        codImp1,
        valImp1,
        codImp2,
        valImp2,
        codImp3,
        valImp3,
        valTot,
        input.sellerNit,
        input.buyerDocument,
        input.technicalKey,
        input.environment,
    ].join('');

    return crypto.createHash('sha384').update(rawString, 'utf8').digest('hex');
}

/**
 * Calcula el CUDE para Notas Crédito y Débito (Algoritmo SHA-384 con Software PIN).
 */
export function generateCude(input: CudeInput): string {
    const valDoc = input.subtotal.toFixed(2);
    const codImp1 = '01';
    const valImp1 = input.ivaAmount.toFixed(2);
    const codImp2 = '04';
    const valImp2 = input.consumptionTax.toFixed(2);
    const codImp3 = '03';
    const valImp3 = input.icaTax.toFixed(2);
    const valTot = input.total.toFixed(2);

    const rawString = [
        input.documentNumber,
        input.issueDate,
        input.issueTime,
        valDoc,
        codImp1,
        valImp1,
        codImp2,
        valImp2,
        codImp3,
        valImp3,
        valTot,
        input.sellerNit,
        input.buyerDocument,
        input.softwarePin,
        input.environment,
    ].join('');

    return crypto.createHash('sha384').update(rawString, 'utf8').digest('hex');
}

/**
 * Genera el contenido del código QR oficial DIAN.
 */
export function generateDianQrContent(params: {
    documentNumber: string;
    issueDate: string;
    issueTime: string;
    sellerNit: string;
    buyerDocument: string;
    ivaAmount: number;
    total: number;
    cufeOrCude: string;
    environment: '1' | '2';
}): string {
    const baseUrl = params.environment === '1'
        ? 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey='
        : 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=';

    const qrParts = [
        `NumFac: ${params.documentNumber}`,
        `FecFac: ${params.issueDate}`,
        `HorFac: ${params.issueTime}`,
        `NitFac: ${params.sellerNit}`,
        `DocAdq: ${params.buyerDocument}`,
        `ValFac: ${(params.total - params.ivaAmount).toFixed(2)}`,
        `ValIva: ${params.ivaAmount.toFixed(2)}`,
        `ValOtroIm: 0.00`,
        `ValTolFac: ${params.total.toFixed(2)}`,
        `CUFE: ${params.cufeOrCude}`,
        `QRCode: ${baseUrl}${params.cufeOrCude}`,
    ];

    return qrParts.join('\n');
}

/**
 * Módulo de firma digital XAdES-EPES simulado/preparado para UBL 2.1.
 */
export function signUblXml(xmlContent: string, _certPem?: string): { signedXml: string; signatureDigest: string } {
    const signatureDigest = crypto.createHash('sha256').update(xmlContent, 'utf8').digest('base64');
    const signedXml = xmlContent.replace(
        '</Invoice>',
        `  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:DigestValue>${signatureDigest}</ds:DigestValue></ds:Signature></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>\n</Invoice>`
    );
    return { signedXml, signatureDigest };
}
