// src/services/partnerContractPdfGenerator.js
import jsPDF from 'jspdf';

/**
 * Generate a professional partner contract PDF
 * @param {Object} contract - Partner contract data
 * @param {Object} partnerData - Partner information
 * @param {string} logoUrl - Company logo URL
 * @param {Function} t - Translation function
 */
export const generatePartnerContractPDF = async (contract, partnerData, logoUrl, t) => {
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
    const primaryColor = '#2563eb'; // Blue
    const secondaryColor = '#374151'; // Gray
    const lightGray = '#f3f4f6';
    const accentColor = '#10b981'; // Green for financial info
    
    // Helper function to add text with word wrapping
    const addWrappedText = (text, x, y, maxWidth, lineHeight = 6) => {
      const lines = pdf.splitTextToSize(text, maxWidth);
      pdf.text(lines, x, y);
      return y + (lines.length * lineHeight);
    };
    
    // Helper function to format currency
    const formatCurrency = (amount, currency = 'EUR') => {
      // Get currency from the contract's plan, not hardcoded
      const contractCurrency = contract.partners_pricing_plans?.currency || currency;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: contractCurrency,
        minimumFractionDigits: 2,
      }).format(amount);
    };
    
    // Helper function to format date
    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('it-IT');
    };

    // 1. HEADER SECTION with Company Logo
    if (logoUrl) {
      try {
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
    
    // Company information (right side of header)
    const companyInfoX = pageWidth - margin - 80;
    let companyY = margin;
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(secondaryColor);
    pdf.text('MLM GmbH', companyInfoX, companyY);
    companyY += 7;
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Industriepark 11', companyInfoX, companyY);
    companyY += 4;
    pdf.text('8100 Uster, Svizzera', companyInfoX, companyY);
    companyY += 4;
    pdf.text('P.IVA: CHE-418.799.480', companyInfoX, companyY);
    companyY += 4;
    pdf.text('info@mlm.com', companyInfoX, companyY);
    
    currentY = Math.max(currentY, companyY + 10);
    
    // 2. DOCUMENT TITLE
    currentY += 10;
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor);
    pdf.text(t('partnerContracts.partnerContract') || 'CONTRATTO PARTNER', margin, currentY);
    
    currentY += 15;
    
    // 3. CONTRACT INFORMATION SECTION
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, currentY - 5, contentWidth, 45, 'F');
    
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
    pdf.text(t('partnerContracts.contractNumber') || 'Numero Contratto:', leftColumnX, leftY);
    leftY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(contract.contract_number || 'N/A', leftColumnX, leftY);
    leftY += 8;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('partnerContracts.startDate') || 'Data Inizio:', leftColumnX, leftY);
    leftY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDate(contract.start_date), leftColumnX, leftY);
    leftY += 8;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('partnerContracts.endDate') || 'Data Fine:', leftColumnX, leftY);
    leftY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDate(contract.end_date), leftColumnX, leftY);
    
    // Right column
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('partnerContracts.status') || 'Stato:', rightColumnX, rightY);
    rightY += 5;
    pdf.setFont('helvetica', 'normal');
    
    // Status translation - using contract_status field
    let statusText = 'N/A';
    if (contract.contract_status) {
      const status = contract.contract_status.toLowerCase();
      statusText = t(`partnerContracts.status${status.charAt(0).toUpperCase() + status.slice(1)}`) || 
                  contract.contract_status.toUpperCase();
    }
    pdf.text(statusText, rightColumnX, rightY);
    rightY += 8;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('common.createdAt') || 'Creato il:', rightColumnX, rightY);
    rightY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatDate(contract.created_at), rightColumnX, rightY);
    rightY += 8;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('partnerContracts.plan') || 'Piano:', rightColumnX, rightY);
    rightY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(primaryColor);
    pdf.text(contract.partners_pricing_plans?.plan_name || 'N/A', rightColumnX, rightY);
    
    currentY += 40;
    
    // 4. PARTNER INFORMATION
    currentY += 5;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor);
    pdf.text(t('partnerContracts.partnerInfo') || 'INFORMAZIONI PARTNER', margin, currentY);
    
    currentY += 10;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(secondaryColor);

    
    console.log('=== PDF DEBUG DATA ===');
    console.log('Contract data:', contract);
    console.log('Partner data:', partnerData);
    console.log('Contract pricing plan:', contract.partners_pricing_plans);
    console.log('Contract currency:', contract.currency);
    console.log('Plan currency:', contract.partners_pricing_plans?.currency);
    console.log('======================');

    if (partnerData) {
      // Company name (if exists)
      if (partnerData.company_name) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Azienda: ${partnerData.company_name}`, margin, currentY);
        currentY += 6;
        pdf.setFont('helvetica', 'normal');
      }
      
      // Responsible person name
      if (partnerData.first_name || partnerData.second_name) {
        const name = `${partnerData.first_name || ''} ${partnerData.second_name || ''}`.trim();
        pdf.text(`Responsabile: ${name}`, margin, currentY);
        currentY += 5;
      }
      
      // Address street
      if (partnerData.address) {
        pdf.text(`Indirizzo: ${partnerData.address}`, margin, currentY);
        currentY += 5;
      }
      
      // ZIP and City
      if (partnerData.zip || partnerData.city) {
        const location = `${partnerData.zip || ''} ${partnerData.city || ''}`.trim();
        if (location) {
          pdf.text(`Località: ${location}`, margin, currentY);
          currentY += 5;
        }
      }
      
      // Country
      if (partnerData.country) {
        pdf.text(`Paese: ${partnerData.country}`, margin, currentY);
        currentY += 5;
      }
      
      // VAT information
      if (partnerData.piva) {
        pdf.text(`P.IVA: ${partnerData.piva}`, margin, currentY);
        currentY += 5;
      }
      
      // Email
      if (partnerData.email) {
        pdf.text(`Email: ${partnerData.email}`, margin, currentY);
        currentY += 5;
      }
      
      // Phone
      if (partnerData.phone) {
        pdf.text(`Telefono: ${partnerData.phone}`, margin, currentY);
        currentY += 5;
      }
      
      // DEBUG: Log what fields are available
      console.log('Available partner fields:', Object.keys(partnerData));
      console.log('Partner data details:', {
        company_name: partnerData.company_name,
        first_name: partnerData.first_name,
        second_name: partnerData.second_name,
        address: partnerData.address,
        zip: partnerData.zip,
        city: partnerData.city,
        country: partnerData.country,
        piva: partnerData.piva,
        email: partnerData.email,
        phone: partnerData.phone
      });
    } else {
      console.log('ERROR: partnerData is null or undefined');
    }
    
    // 5. PRICING PLAN DETAILS
    currentY += 15;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor);
    pdf.text(t('partnerContracts.pricingDetails') || 'DETTAGLI PIANO TARIFFARIO', margin, currentY);
    
    currentY += 10;
    
    // Pricing table
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
    
    pdf.text(t('partnerContracts.planName') || 'Piano', col1X, currentY);
    pdf.text(t('partnerContracts.planType') || 'Tipo', col2X, currentY);
    pdf.text(t('partnerContracts.billing') || 'Fatturazione', col3X, currentY);
    pdf.text(t('partnerContracts.amount') || 'Importo', col4X, currentY);
    
    currentY += 8;
    
    // Table content with actual field mappings
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    
    const plan = contract.partners_pricing_plans;
    if (plan) {
      // Plan name
      pdf.text(plan.plan_name || 'N/A', col1X, currentY);
      
      // Plan type - determine from billing frequency
      let planType = 'Standard';
      if (contract.billing_frequency === 'monthly') {
        planType = t('partnerContracts.monthly') || 'Mensile';
      } else if (contract.billing_frequency === 'yearly') {
        planType = t('partnerContracts.yearly') || 'Annuale';
      }
      pdf.text(planType, col2X, currentY);
      
      // Billing frequency
      let billingText = contract.billing_frequency || 'N/A';
      if (contract.billing_frequency === 'monthly') {
        billingText = t('partnerContracts.monthly') || 'Mensile';
      } else if (contract.billing_frequency === 'yearly') {
        billingText = t('partnerContracts.yearly') || 'Annuale';
      }
      pdf.text(billingText, col3X, currentY);
      
      // Amount - use the correct price based on billing frequency
      let price = 0;
      const currency = contract.partners_pricing_plans?.currency || contract.currency || 'EUR';
      
      console.log('Currency being used:', currency);
      console.log('Plan currency:', contract.partners_pricing_plans?.currency);
      console.log('Contract currency:', contract.currency);


      if (contract.billing_frequency === 'monthly') {
        price = plan.monthly_price || contract.final_price || 0;
      } else if (contract.billing_frequency === 'yearly') {
        price = plan.yearly_price || contract.final_price || 0;
      } else {
        price = contract.final_price || 0;
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(accentColor);
      
      if (price && price > 0) {
        const amountText = formatCurrency(price, currency);
        pdf.text(amountText, col4X, currentY);
      } else {
        pdf.text('N/A', col4X, currentY);
      }
      
      currentY += 8;
      
      // Additional plan features
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(secondaryColor);
      pdf.setFontSize(8);
      
      // Show both monthly and yearly prices if available
      if (plan.monthly_price && plan.yearly_price) {
        const currency = plan.currency || 'EUR'; // Use plan's currency
        pdf.text(`${t('partnerContracts.monthlyPrice') || 'Prezzo Mensile'}: ${formatCurrency(plan.monthly_price, currency)}`, col1X, currentY);
        currentY += 4;
        pdf.text(`${t('partnerContracts.yearlyPrice') || 'Prezzo Annuale'}: ${formatCurrency(plan.yearly_price, currency)}`, col1X, currentY);
        currentY += 4;
      }
      
      // Show discount if any
      if (contract.discount_amount && contract.discount_amount > 0) {
        const currency = plan.currency || 'EUR'; // Use plan's currency
        pdf.text(`${t('partnerContracts.discount') || 'Sconto'}: ${formatCurrency(contract.discount_amount, currency)}`, col1X, currentY);
        currentY += 4;
      }
      
    } else {
      // No plan data available
      pdf.text('N/A', col1X, currentY);
      pdf.text('N/A', col2X, currentY);
      pdf.text('N/A', col3X, currentY);
      pdf.text('N/A', col4X, currentY);
      currentY += 8;
    }
    
    currentY += 5;
    
    // 6. PAYMENT TERMS
    if (contract.contract_terms || contract.billing_frequency || contract.auto_renew !== null) {
      currentY += 5;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(primaryColor);
      pdf.text(t('partnerContracts.paymentTerms') || 'TERMINI DI PAGAMENTO', margin, currentY);
      
      currentY += 10;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(secondaryColor);
      
      if (contract.billing_frequency) {
        let billingText = contract.billing_frequency;
        if (contract.billing_frequency === 'monthly') {
          billingText = t('partnerContracts.monthly') || 'Mensile';
        } else if (contract.billing_frequency === 'yearly') {
          billingText = t('partnerContracts.yearly') || 'Annuale';
        }
        pdf.text(`${t('partnerContracts.billingCycle') || 'Ciclo di fatturazione'}: ${billingText}`, margin, currentY);
        currentY += 6;
      }
      
      if (contract.auto_renew !== null) {
        const autoRenewText = contract.auto_renew ? 
          t('partnerContracts.autoRenewEnabled') || 'Rinnovo automatico abilitato' :
          t('partnerContracts.autoRenewDisabled') || 'Rinnovo automatico disabilitato';
        pdf.text(autoRenewText, margin, currentY);
        currentY += 6;
      }
      
      if (contract.contract_terms) {
        currentY = addWrappedText(`${t('partnerContracts.terms') || 'Termini'}: ${contract.contract_terms}`, margin, currentY, contentWidth, 5);
      }
    }
    
    // 7. FOOTER
    currentY = pageHeight - 35;
    
    // Footer line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    
    currentY += 10;
    
    // Footer text
    pdf.setFontSize(8);
    pdf.setTextColor('#9ca3af');
    pdf.setFont('helvetica', 'italic');
    
    const footerText = t('partnerContracts.contractFooter') || 
      'Questo documento rappresenta il contratto di partnership. Per modifiche contattare l\'amministrazione.';
    currentY = addWrappedText(footerText, margin, currentY, contentWidth, 4);
    
    currentY += 12;
    
    // Generation date
    const generatedText = `${t('partnerContracts.generatedOn') || 'Generato il'}: ${formatDate(new Date().toISOString())}`;
    pdf.text(generatedText, margin, currentY);
    
    // Document number (right aligned)
    pdf.setFont('helvetica', 'normal');
    const docNumber = `PARTNER-${Date.now()}`;
    pdf.text(docNumber, pageWidth - margin - pdf.getTextWidth(docNumber), currentY);
    
    // 8. SAVE/DOWNLOAD PDF
    const fileName = `partner-contract-${contract.contract_number || contract.id}.pdf`;
    pdf.save(fileName);
    
    return true;
    
  } catch (error) {
    console.error('Error generating partner contract PDF:', error);
    throw new Error('Failed to generate partner contract PDF');
  }
};