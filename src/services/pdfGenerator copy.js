// src/services/pdfGenerator.js
import jsPDF from 'jspdf';

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
    const primaryColor = '#16a34a'; // Green
    const secondaryColor = '#374151'; // Gray
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
            console.warn('Could not load logo for PDF');
            resolve(); // Continue without logo
          };
          
          img.src = logoUrl;
        });
        
        currentY += 30; // Space after logo
      } catch (error) {
        console.warn('Error loading logo:', error);
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
    currentY += 10;
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor);
    pdf.text(t('contracts.contractReceipt') || 'RICEVUTA CONTRATTO', margin, currentY);
    
    currentY += 15;
    
    // 3. CONTRACT INFORMATION SECTION
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, currentY - 5, contentWidth, 40, 'F');
    
    currentY += 5;
    
    // Contract details in two columns
    const leftColumnX = margin + 5;
    const rightColumnX = margin + (contentWidth / 2) + 5;
    let leftY = currentY;
    let rightY = currentY;
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(secondaryColor);
    
    // Left column
    pdf.text(t('contracts.contractNumber') || 'Numero Contratto:', leftColumnX, leftY);
    leftY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(contract.contract_number || 'N/A', leftColumnX, leftY);
    leftY += 8;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('contracts.startDate') || 'Data Inizio:', leftColumnX, leftY);
    leftY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDate(contract.start_date), leftColumnX, leftY);
    leftY += 8;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('contracts.endDate') || 'Data Fine:', leftColumnX, leftY);
    leftY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDate(contract.end_date), leftColumnX, leftY);
    
    // Right column
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('contracts.status') || 'Stato:', rightColumnX, rightY);
    rightY += 5;
    pdf.setFont('helvetica', 'normal');
    const statusText = t(`contracts.${contract.contract_status}`) || contract.contract_status;
    pdf.text(statusText.toUpperCase(), rightColumnX, rightY);
    rightY += 8;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('common.createdAt') || 'Creato il:', rightColumnX, rightY);
    rightY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDate(contract.created_at), rightColumnX, rightY);
    rightY += 8;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('contracts.cost') || 'Costo:', rightColumnX, rightY);
    rightY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(primaryColor);
    pdf.text(formatCurrency(contract.service_cost, contract.service_currency), rightColumnX, rightY);
    
    currentY += 45;
    
    // 4. CUSTOMER INFORMATION
    currentY += 10;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor);
    pdf.text(t('contracts.customer') || 'CLIENTE', margin, currentY);
    
    currentY += 10;
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
        pdf.setTextColor('#6b7280');
        pdf.text(`${t('customers.codiceFiscale') || 'Codice Fiscale'}: ${customer.codice_fiscale}`, margin, currentY);
        currentY += 4;
        pdf.setFontSize(10);
        pdf.setTextColor(secondaryColor);
      }
      
      if (customer.piva) {
        pdf.setFontSize(9);
        pdf.setTextColor('#6b7280');
        pdf.text(`${t('customers.piva') || 'P.IVA'}: ${customer.piva}`, margin, currentY);
        currentY += 4;
        pdf.setFontSize(10);
        pdf.setTextColor(secondaryColor);
      }
    }
    
    // 5. SERVICE INFORMATION
    currentY += 15;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor);
    pdf.text(t('contracts.service') || 'SERVIZIO', margin, currentY);
    
    currentY += 10;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(secondaryColor);
    
    // Service details table
    const tableStartY = currentY;
    
    // Table headers
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, currentY, contentWidth, 8, 'F');
    
    currentY += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    
    const col1X = margin + 2;
    const col2X = margin + 60;
    const col3X = margin + 100;
    const col4X = margin + 140;
    
    pdf.text(t('services.serviceName') || 'Servizio', col1X, currentY);
    pdf.text(t('services.type') || 'Tipo', col2X, currentY);
    pdf.text(t('contracts.location') || 'Sede', col3X, currentY);
    pdf.text(t('contracts.cost') || 'Costo', col4X, currentY);
    
    currentY += 8;
    
    // Table content
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
    const cost = formatCurrency(contract.service_cost, contract.service_currency);
    
    // Add service row
    currentY = addWrappedText(serviceName, col1X, currentY, 55, 4);
    currentY -= 4; // Reset to row baseline
    pdf.text(serviceType, col2X, currentY);
    pdf.text(locationName, col3X, currentY);
    pdf.setTextColor(primaryColor);
    pdf.text(cost, col4X, currentY);
    pdf.setTextColor(secondaryColor);
    
    currentY += 8;
    
    // Resource information
    if (contract.resource_name && contract.resource_name !== 'Unknown Resource') {
      pdf.setFontSize(8);
      pdf.setTextColor('#6b7280');
      pdf.text(`${t('contracts.resource') || 'Risorsa'}: ${contract.resource_name}`, col1X, currentY);
      currentY += 5;
    }
    
    // Package entries info
    if (contract.service_type === 'pacchetto' && contract.service_max_entries) {
      pdf.setFontSize(8);
      pdf.setTextColor('#6b7280');
      const entriesText = `${t('contracts.includedEntries') || 'Ingressi inclusi'}: ${contract.service_max_entries}`;
      pdf.text(entriesText, col1X, currentY);
      currentY += 5;
      
      if (contract.entries_used !== undefined && contract.entries_used !== null) {
        const usedText = `${t('contracts.entriesUsed') || 'Ingressi utilizzati'}: ${contract.entries_used}`;
        pdf.text(usedText, col1X, currentY);
        currentY += 5;
        
        const remainingText = `${t('reservations.entriesRemaining') || 'Ingressi rimanenti'}: ${contract.service_max_entries - contract.entries_used}`;
        pdf.text(remainingText, col1X, currentY);
        currentY += 5;
      }
    }
    
    // 6. FOOTER
    currentY = pageHeight - 40;
    
    // Footer line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    
    currentY += 10;
    
    // Footer text
    pdf.setFontSize(8);
    pdf.setTextColor('#9ca3af');
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
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
};