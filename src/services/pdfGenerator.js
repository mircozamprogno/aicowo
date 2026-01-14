// src/services/pdfGenerator.js
import jsPDF from 'jspdf';
import logger from '../utils/logger';

/**
 * Generate a professional contract PDF receipt
 * @param {Object} contract - Contract data
 * @param {Object} partnerData - Partner information
 * @param {string} logoUrl - Partner logo URL
 * @param {Function} t - Translation function
 */
export const generateContractPDF = async (contract, partnerData, logoUrl, t) => {
  try {
    // Create new PDF document - A4 size
    const pdf = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Define margins and positions
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let currentY = margin;

    // Color scheme
    const primaryColor = '#000000'; // Black
    const secondaryColor = '#000000'; // Black
    const lightGray = '#f3f4f6';

    // Helper function to add text with word wrapping
    const addWrappedText = (text, x, y, maxWidth, lineHeight = 6) => {
      const lines = pdf.splitTextToSize(text, maxWidth);
      pdf.text(lines, x, y);
      return y + (lines.length * lineHeight);
    };

    // Helper function to format currency
    const formatCurrency = (amount, currency = 'EUR') => {
      return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
      }).format(amount);
    };

    // Helper function to format date
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('it-IT');
    };

    // 1. HEADER SECTION with Logo and Partner Info
    if (logoUrl) {
      try {
        // Load and add logo
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve, reject) => {
          img.onload = () => {
            // Calculate logo dimensions (max 40mm width, maintain aspect ratio)
            const maxLogoWidth = 40;
            const maxLogoHeight = 25;
            const aspectRatio = img.width / img.height;

            let logoWidth = maxLogoWidth;
            let logoHeight = logoWidth / aspectRatio;

            if (logoHeight > maxLogoHeight) {
              logoHeight = maxLogoHeight;
              logoWidth = logoHeight * aspectRatio;
            }

            // Add logo to PDF
            pdf.addImage(img, 'PNG', margin, currentY, logoWidth, logoHeight);
            resolve();
          };

          img.onerror = () => {
            logger.warn('Could not load logo for PDF');
            resolve(); // Continue without logo
          };

          img.src = logoUrl;
        });

        currentY += 30; // Space after logo
      } catch (error) {
        logger.warn('Error loading logo:', error);
        currentY += 10;
      }
    }

    // Partner company information (right side of header)
    if (partnerData) {
      const partnerInfoX = pageWidth - margin - 80;
      let partnerY = margin;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(secondaryColor);

      if (partnerData.company_name) {
        pdf.text(partnerData.company_name, partnerInfoX, partnerY);
        partnerY += 7;
      }

      if (partnerData.structure_name) {
        pdf.setFontSize(10);
        pdf.text(partnerData.structure_name, partnerInfoX, partnerY);
        partnerY += 7;
        pdf.setFontSize(12); // Reset for consistency checks below, though logic changes size explicitly
      }

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');

      if (partnerData.address) {
        partnerY = addWrappedText(partnerData.address, partnerInfoX, partnerY, 75, 4);
      }

      if (partnerData.zip || partnerData.city) {
        const location = `${partnerData.zip || ''} ${partnerData.city || ''}`.trim();
        if (location) {
          pdf.text(location, partnerInfoX, partnerY);
          partnerY += 4;
        }
      }

      if (partnerData.country) {
        pdf.text(partnerData.country, partnerInfoX, partnerY);
        partnerY += 4;
      }

      if (partnerData.piva) {
        pdf.text(`P.IVA: ${partnerData.piva}`, partnerInfoX, partnerY);
        partnerY += 4;
      }

      if (partnerData.email) {
        pdf.text(partnerData.email, partnerInfoX, partnerY);
        partnerY += 4;
      }

      if (partnerData.phone) {
        pdf.text(partnerData.phone, partnerInfoX, partnerY);
      }

      currentY = Math.max(currentY, partnerY + 10);
    }

    // 2. DOCUMENT TITLE
    currentY += 5; // Reduced from 10
    pdf.setFontSize(14); // Reduced from 18
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor);
    pdf.text(t('contracts.contractReceipt') || 'RICEVUTA CONTRATTO', margin, currentY);

    currentY += 8; // Reduced from 15

    // 3. CONTRACT INFORMATION SECTION
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, currentY - 5, contentWidth, 25, 'F'); // Reduced height from 40 to 25

    currentY += 5;

    // Contract details in two columns
    const leftColumnX = margin + 5;
    const rightColumnX = margin + (contentWidth / 2) + 5;
    let leftY = currentY;
    let rightY = currentY;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(secondaryColor);

    // Row 1: Contract Number (Left) and Cost (Right)
    pdf.text(t('contracts.contractNumber') || 'Numero Contratto:', leftColumnX, leftY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(contract.contract_number || 'N/A', leftColumnX + 40, leftY);

    pdf.setFont('helvetica', 'bold');
    pdf.text(t('contracts.cost') || 'Costo:', rightColumnX, rightY);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(primaryColor);
    pdf.text(formatCurrency(contract.service_cost, contract.service_currency), rightColumnX + 20, rightY);
    pdf.setTextColor(secondaryColor);

    leftY += 8;
    rightY += 8;

    // Row 2: Start Date (Left) and End Date (Right)
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('contracts.startDate') || 'Data Inizio:', leftColumnX, leftY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDate(contract.start_date), leftColumnX + 40, leftY);

    pdf.setFont('helvetica', 'bold');
    pdf.text(t('contracts.endDate') || 'Data Fine:', rightColumnX, rightY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDate(contract.end_date), rightColumnX + 20, rightY);

    currentY += 25; // Adjusted spacing

    // 4. CUSTOMER INFORMATION
    currentY += 5; // Reduced from 10
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor);
    pdf.text(t('contracts.customer') || 'CLIENTE', margin, currentY);

    currentY += 8; // Reduced from 10
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(secondaryColor);

    if (contract.customers) {
      const customer = contract.customers;

      // Company name (if exists)
      if (customer.company_name) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(customer.company_name, margin, currentY);
        currentY += 6;
        pdf.setFont('helvetica', 'normal');
      }

      // Customer name
      if (customer.first_name || customer.second_name) {
        const name = `${customer.first_name || ''} ${customer.second_name || ''}`.trim();
        pdf.text(name, margin, currentY);
        currentY += 5;
      }

      // Email
      if (customer.email) {
        pdf.text(customer.email, margin, currentY);
        currentY += 5;
      }

      // Phone (if available)
      if (customer.phone) {
        pdf.text(customer.phone, margin, currentY);
        currentY += 5;
      }

      // Address
      if (customer.address) {
        currentY = addWrappedText(customer.address, margin, currentY, contentWidth * 0.6, 5);
      }

      // ZIP and City
      if (customer.zip || customer.city) {
        const location = `${customer.zip || ''} ${customer.city || ''}`.trim();
        if (location) {
          pdf.text(location, margin, currentY);
          currentY += 5;
        }
      }

      // Country
      if (customer.country && customer.country !== 'Italy') {
        pdf.text(customer.country, margin, currentY);
        currentY += 5;
      }

      // Tax information (if available)
      if (customer.codice_fiscale) {
        pdf.setFontSize(9);
        pdf.setTextColor(secondaryColor); // Black
        pdf.text(`${t('customers.codiceFiscale') || 'Codice Fiscale'}: ${customer.codice_fiscale}`, margin, currentY);
        currentY += 4;
        pdf.setFontSize(10);
      }

      if (customer.piva) {
        pdf.setFontSize(9);
        pdf.setTextColor(secondaryColor); // Black
        pdf.text(`${t('customers.piva') || 'P.IVA'}: ${customer.piva}`, margin, currentY);
        currentY += 4;
        pdf.setFontSize(10);
      }
    }

    // 5. SERVICE INFORMATION
    currentY += 10;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor);
    pdf.text(t('contracts.service') || 'SERVIZIO', margin, currentY);

    currentY += 8;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(secondaryColor);

    // Service details table with better column structure
    // Table headers
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, currentY, contentWidth, 8, 'F');

    currentY += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);

    // Adjusted column positions for better spacing
    const col1X = margin + 2;       // Service Name (reduced width)
    const col2X = margin + 45;      // Type (reduced width) 
    const col3X = margin + 70;      // Location (reduced width)
    const col4X = margin + 105;     // Cost Label
    const col5X = margin + 140;     // Cost Amount

    pdf.text(t('services.serviceName') || 'Servizio', col1X, currentY);
    pdf.text(t('services.type') || 'Tipo', col2X, currentY);
    pdf.text(t('contracts.location') || 'Sede', col3X, currentY);
    pdf.text(t('contracts.cost') || 'Costo', col4X, currentY);

    currentY += 8;

    // Table content with VAT calculations
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);

    const serviceName = contract.service_name || 'N/A';

    // Fix service type translation
    let serviceType = 'N/A';
    if (contract.service_type) {
      switch (contract.service_type) {
        case 'abbonamento':
          serviceType = t('services.subscription') || 'Abbonamento';
          break;
        case 'pacchetto':
          serviceType = t('services.package') || 'Pacchetto';
          break;
        case 'free_trial':
          serviceType = t('services.freeTrial') || 'Prova Gratuita';
          break;
        default:
          serviceType = contract.service_type;
      }
    }

    const locationName = contract.location_name || 'N/A';

    // VAT Calculations
    const baseAmount = contract.service_cost || 0;
    const vatPercentage = contract.location_data?.vat_percentage || 0;
    const vatAmount = baseAmount * (vatPercentage / 100);
    const totalAmount = baseAmount + vatAmount;

    // Service basic info (first row)
    const startY = currentY;
    currentY = addWrappedText(serviceName, col1X, currentY, 40, 4);
    const serviceNameHeight = currentY - startY;

    // Reset to baseline for other columns
    currentY = startY;
    pdf.text(serviceType, col2X, currentY);
    currentY = addWrappedText(locationName, col3X, currentY, 32, 4);
    const locationHeight = currentY - startY;

    // Reset to service row baseline
    currentY = startY;

    // Cost breakdown in two properly aligned columns
    pdf.setTextColor(secondaryColor);
    pdf.setFontSize(9);

    // Base amount row
    pdf.text(t('contracts.baseAmount') || 'Netto', col4X, currentY);
    pdf.text(formatCurrency(baseAmount, contract.service_currency), col5X + 25 - pdf.getTextWidth(formatCurrency(baseAmount, contract.service_currency)), currentY);
    currentY += 5;

    // VAT row
    const vatLabel = `${t('contracts.vat') || 'IVA'} (${vatPercentage}%):`;
    pdf.text(vatLabel, col4X, currentY);
    pdf.text(formatCurrency(vatAmount, contract.service_currency), col5X + 25 - pdf.getTextWidth(formatCurrency(vatAmount, contract.service_currency)), currentY);
    currentY += 5;

    // Total row with emphasis
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor);
    pdf.text(t('contracts.total') || 'Totale', col4X, currentY);
    const totalText = formatCurrency(totalAmount, contract.service_currency);
    pdf.text(totalText, col5X + 25 - pdf.getTextWidth(totalText), currentY);

    // Reset formatting
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(secondaryColor);
    pdf.setFontSize(9);

    // Ensure we move past all content (service name, location, or cost breakdown)
    const costBreakdownHeight = 15; // 3 rows * 5 points each
    currentY = startY + Math.max(serviceNameHeight, locationHeight, costBreakdownHeight);
    currentY += 8;

    // Resource information (keep existing code)
    if (contract.resource_name && contract.resource_name !== 'Unknown Resource') {
      pdf.setFontSize(8);
      pdf.setTextColor(secondaryColor); // Black
      pdf.text(`${t('contracts.resource') || 'Risorsa'}: ${contract.resource_name}`, col1X, currentY);
      currentY += 5;
    }

    // Package entries info (condensed to one row)
    if (contract.service_type === 'pacchetto' && contract.service_max_entries) {
      pdf.setFontSize(8);
      pdf.setTextColor(secondaryColor); // Black

      let entriesText = `${t('contracts.includedEntries') || 'Ingressi'}: ${contract.service_max_entries}`;

      if (contract.entries_used !== undefined && contract.entries_used !== null) {
        entriesText += ` | ${t('contracts.entriesUsed') || 'Utilizzati'}: ${contract.entries_used}`;
        entriesText += ` | ${t('reservations.entriesRemaining') || 'Rimanenti'}: ${contract.service_max_entries - contract.entries_used}`;
      }

      pdf.text(entriesText, col1X, currentY);
      currentY += 5;
    }

    // 6. FOOTER

    // Check if we need a new page for footer to avoid overlap
    const footerHeight = 35; // Height needed for footer elements
    const footerStartY = pageHeight - 40;

    if (currentY > footerStartY - 10) {
      // Logic removed to force single page as requested, but keep safety check if currentY is way past
      // pdf.addPage();
      // currentY = pageHeight - 40;
      currentY = Math.max(currentY + 5, footerStartY);
    } else {
      currentY = Math.max(currentY + 10, footerStartY);
    }

    // Footer line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, currentY, pageWidth - margin, currentY);

    currentY += 10;

    // Footer text
    pdf.setFontSize(8);
    pdf.setTextColor(secondaryColor); // Black as requested
    pdf.setFont('helvetica', 'italic');

    const footerText = t('contracts.receiptFooter') ||
      'Questo documento è una ricevuta del contratto di servizio. Non ha valore fiscale.';
    currentY = addWrappedText(footerText, margin, currentY, contentWidth, 4);

    currentY += 8;

    // Generation date
    const generatedText = `${t('contracts.generatedOn') || 'Generato il'}: ${formatDate(new Date().toISOString())}`;
    pdf.text(generatedText, margin, currentY);

    // Document number (right aligned)
    pdf.setFont('helvetica', 'normal');
    const docNumber = `DOC-${Date.now()}`;
    pdf.text(docNumber, pageWidth - margin - pdf.getTextWidth(docNumber), currentY);

    // 7. SAVE/DOWNLOAD PDF
    const fileName = `contract-${contract.contract_number || contract.id}-receipt.pdf`;
    pdf.save(fileName);

    return true;

  } catch (error) {
    logger.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
};



/**
 * Generate a professional invoice PDF
 * @param {Object} payment - Payment/Invoice data from partners_payments table
 * @param {Object} partnerData - Partner information
 * @param {string} logoUrl - Partner logo URL (optional)
 * @param {Function} t - Translation function
 */
export const generateInvoicePDF = async (payment, partnerData, logoUrl, t) => {
  try {
    // DEBUG: Log the payment object to see what data we have
    logger.log('=== PDF GENERATION DEBUG ===');
    logger.log('Full payment object:', payment);
    logger.log('invoice_number field:', payment.invoice_number);
    logger.log('All payment keys:', Object.keys(payment));
    logger.log('=========================');

    // Create new PDF document - A4 size
    const pdf = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Define margins and positions
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let currentY = margin;

    // Color scheme
    const primaryColor = '#16a34a'; // Green
    const secondaryColor = '#374151'; // Gray

    // Helper functions
    const addWrappedText = (text, x, y, maxWidth, lineHeight = 6) => {
      const lines = pdf.splitTextToSize(text, maxWidth);
      pdf.text(lines, x, y);
      return y + (lines.length * lineHeight);
    };

    const formatCurrency = (amount, currency = 'EUR') => {
      return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
      }).format(amount);
    };

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleDateString('it-IT');
    };

    // 1. HEADER with Logo (if provided)
    if (logoUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve) => {
          img.onload = () => {
            const maxLogoWidth = 40;
            const maxLogoHeight = 25;
            const aspectRatio = img.width / img.height;

            let logoWidth = maxLogoWidth;
            let logoHeight = logoWidth / aspectRatio;

            if (logoHeight > maxLogoHeight) {
              logoHeight = maxLogoHeight;
              logoWidth = logoHeight * aspectRatio;
            }

            pdf.addImage(img, 'PNG', margin, currentY, logoWidth, logoHeight);
            resolve();
          };

          img.onerror = () => resolve();
          img.src = logoUrl;
        });

        currentY += 30;
      } catch (error) {
        currentY += 10;
      }
    }

    // Partner information (right side)
    if (partnerData) {
      const partnerInfoX = pageWidth - margin - 80;
      let partnerY = margin;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(secondaryColor);

      if (partnerData.company_name) {
        pdf.text(partnerData.company_name, partnerInfoX, partnerY);
        partnerY += 7;
      }

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');

      if (partnerData.address) {
        partnerY = addWrappedText(partnerData.address, partnerInfoX, partnerY, 75, 4);
      }

      if (partnerData.zip || partnerData.city) {
        const location = `${partnerData.zip || ''} ${partnerData.city || ''}`.trim();
        if (location) {
          pdf.text(location, partnerInfoX, partnerY);
          partnerY += 4;
        }
      }

      if (partnerData.piva) {
        pdf.text(`P.IVA: ${partnerData.piva}`, partnerInfoX, partnerY);
        partnerY += 4;
      }

      if (partnerData.email) {
        pdf.text(partnerData.email, partnerInfoX, partnerY);
      }

      currentY = Math.max(currentY, partnerY + 10);
    }

    // 2. TITLE
    currentY += 10;
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor);
    pdf.text(t('partnerBilling.invoice') || 'FATTURA', margin, currentY);

    currentY += 15;

    // 3. INVOICE INFO BOX
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, currentY - 5, contentWidth, 50, 'F');

    currentY += 5;

    const leftColumnX = margin + 5;
    const rightColumnX = margin + (contentWidth / 2) + 5;
    let leftY = currentY;
    let rightY = currentY;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(secondaryColor);

    // Left column
    pdf.text(t('partnerBilling.invoiceNumber') || 'Numero Fattura:', leftColumnX, leftY);
    leftY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text(payment.invoice_number || 'N/A', leftColumnX, leftY);
    leftY += 10;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('partnerBilling.billingPeriod') || 'Periodo:', leftColumnX, leftY);
    leftY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${formatDate(payment.payment_period_start)} - ${formatDate(payment.payment_period_end)}`, leftColumnX, leftY);
    leftY += 10;

    pdf.setFont('helvetica', 'bold');
    pdf.text(t('partnerBilling.issueDate') || 'Data Emissione:', leftColumnX, leftY);
    leftY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDate(payment.created_at), leftColumnX, leftY);

    // Right column
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('partnerBilling.dueDate') || 'Scadenza:', rightColumnX, rightY);
    rightY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDate(payment.due_date), rightColumnX, rightY);
    rightY += 10;

    pdf.setFont('helvetica', 'bold');
    pdf.text(t('partnerBilling.status') || 'Stato:', rightColumnX, rightY);
    rightY += 5;
    pdf.setFont('helvetica', 'normal');

    // Status with color
    let statusText = payment.payment_status ? payment.payment_status.toUpperCase() : 'N/A';
    let statusColor = secondaryColor;
    if (payment.payment_status === 'paid') {
      statusText = t('partnerBilling.paid') || 'PAGATO';
      statusColor = '#059669';
    } else if (payment.payment_status === 'pending' && payment.is_overdue) {
      statusText = t('partnerBilling.overdue') || 'SCADUTO';
      statusColor = '#dc2626';
    } else if (payment.payment_status === 'pending') {
      statusText = t('partnerBilling.pending') || 'IN ATTESA';
      statusColor = '#d97706';
    }
    pdf.setTextColor(statusColor);
    pdf.text(statusText, rightColumnX, rightY);
    pdf.setTextColor(secondaryColor);
    rightY += 10;

    if (payment.payment_date) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(t('partnerBilling.paymentDate') || 'Data Pagamento:', rightColumnX, rightY);
      rightY += 5;
      pdf.setFont('helvetica', 'normal');
      pdf.text(formatDate(payment.payment_date), rightColumnX, rightY);
    }

    currentY += 55;

    // 4. SERVICE DETAILS
    currentY += 10;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor);
    pdf.text(t('partnerBilling.serviceDetails') || 'DETTAGLIO SERVIZIO', margin, currentY);

    currentY += 10;

    // Plan info from billing_details
    if (payment.billing_details) {
      const details = typeof payment.billing_details === 'string'
        ? JSON.parse(payment.billing_details)
        : payment.billing_details;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(secondaryColor);

      if (details.plan_name) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${t('partnerBilling.plan') || 'Piano'}: `, margin, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(details.plan_name, margin + 20, currentY);
        currentY += 7;
      }
    }

    // Active users
    if (payment.active_users_count !== null) {
      pdf.setFontSize(10);
      pdf.text(`${t('partnerBilling.activeUsers') || 'Utenti Attivi'}: ${payment.active_users_count} / ${payment.plan_active_users_limit || 0}`, margin, currentY);

      if (payment.is_over_limit) {
        pdf.setTextColor('#dc2626');
        pdf.text(`(${t('partnerBilling.overLimit') || 'Oltre Limite'})`, margin + 60, currentY);
        pdf.setTextColor(secondaryColor);
      }

      currentY += 10;
    }

    // 5. AMOUNT TABLE
    currentY += 5;

    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, currentY, contentWidth, 8, 'F');

    currentY += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);

    const descCol = margin + 2;
    const amountCol = pageWidth - margin - 40;

    pdf.text(t('partnerBilling.description') || 'Descrizione', descCol, currentY);
    pdf.text(t('partnerBilling.amount') || 'Importo', amountCol, currentY);

    currentY += 8;

    // Service line
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    const serviceDesc = `${t('partnerBilling.subscriptionService') || 'Servizio Abbonamento'} - ${formatDate(payment.payment_period_start)} / ${formatDate(payment.payment_period_end)}`;
    currentY = addWrappedText(serviceDesc, descCol, currentY, contentWidth - 45, 5);

    const subtotal = Number(payment.amount) || 0;
    pdf.text(formatCurrency(subtotal, payment.currency), amountCol, currentY - 5);

    currentY += 5;

    // Late fee
    if (payment.late_fee && payment.late_fee > 0) {
      pdf.setTextColor('#dc2626');
      pdf.text(t('partnerBilling.lateFee') || 'Mora', descCol, currentY);
      pdf.text(formatCurrency(payment.late_fee, payment.currency), amountCol, currentY);
      pdf.setTextColor(secondaryColor);
      currentY += 7;
    }

    // Total line
    currentY += 5;
    pdf.setDrawColor(220, 220, 220);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 8;

    // TOTAL
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(primaryColor);

    const totalAmount = subtotal + (payment.late_fee || 0);
    pdf.text(t('partnerBilling.totalAmount') || 'TOTALE', descCol, currentY);
    pdf.text(formatCurrency(totalAmount, payment.currency), amountCol, currentY);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(secondaryColor);

    currentY += 15;

    // 6. FOOTER
    currentY = pageHeight - 40;

    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, currentY, pageWidth - margin, currentY);

    currentY += 10;

    pdf.setFontSize(8);
    pdf.setTextColor('#9ca3af');
    pdf.setFont('helvetica', 'italic');

    const footerText = t('partnerBilling.invoiceFooter') ||
      'Questo documento rappresenta una fattura valida per il servizio fornito.';
    currentY = addWrappedText(footerText, margin, currentY, contentWidth, 4);

    currentY += 8;

    const generatedText = `${t('contracts.generatedOn') || 'Generato il'}: ${formatDate(new Date().toISOString())}`;
    pdf.text(generatedText, margin, currentY);

    const docNumber = payment.invoice_number || `INV-${Date.now()}`;
    pdf.text(docNumber, pageWidth - margin - pdf.getTextWidth(docNumber), currentY);

    // 7. SAVE PDF
    const fileName = `invoice-${payment.invoice_number || payment.id}.pdf`;
    pdf.save(fileName);

    return true;

  } catch (error) {
    logger.error('Error generating invoice PDF:', error);
    throw new Error('Failed to generate invoice PDF');
  }
};

// Keep existing generateContractPDF function unchanged
// (Your existing contract PDF generation code remains here)