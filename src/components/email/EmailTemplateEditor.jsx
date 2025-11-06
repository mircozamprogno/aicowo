import { ArrowLeft, Bold, Eye, Italic, Save, Send, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import oneSignalEmailService from '../../services/oneSignalEmailService';
import { supabase } from '../../services/supabase';
import { DEFAULT_EMAIL_TEMPLATES } from '../../utils/defaultEmailTemplates';
import { toast } from '../common/ToastContainer';

const EmailTemplateEditor = ({ template, partnerUuid, onBack }) => {
  const { t, language } = useTranslation();
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // Get default template based on language
  const defaultTemplate = DEFAULT_EMAIL_TEMPLATES[language]?.[template.id] || 
                          DEFAULT_EMAIL_TEMPLATES.en[template.id];



  const loadPartnerData = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('email')
        .eq('partner_uuid', partnerUuid)
        .single();

      if (error) throw error;
      setPartnerEmail(data.email);
    } catch (error) {
      console.error('Error loading partner email:', error);
    }
  };

  const loadBannerUrl = async () => {
    try {
      const { data: files } = await supabase.storage
        .from('partners')
        .list(`${partnerUuid}`, { search: 'email_banner' });

      const bannerFile = files?.find(file => file.name.startsWith('email_banner.'));
      
      if (bannerFile) {
        const { data } = supabase.storage
          .from('partners')
          .getPublicUrl(`${partnerUuid}/${bannerFile.name}`);
        
        setBannerUrl(data.publicUrl);
      }
    } catch (error) {
      console.error('Error loading banner URL:', error);
    }
  };

  const handleSendTest = async () => {
    if (!partnerEmail) {
      toast.error('Email partner non trovata');
      return;
    }

    if (!bodyHtml.trim()) {
      toast.error(t('emailTemplates.bodyRequired'));
      return;
    }

    setSendingTest(true);
    try {
      // Replace variables with sample data for test email
      let testBodyHtml = bodyHtml;
      const sampleData = {
        '{{partner_name}}': 'Your Company',
        '{{customer_name}}': 'John Doe',
        '{{admin_name}}': 'Jane Smith',
        '{{invitation_link}}': '#',
        '{{custom_message}}': 'Welcome to our platform!',
        '{{booking_date}}': 'Monday, December 15, 2024',
        '{{resource}}': 'Meeting Room A',
        '{{remaining_count}}': '5',
        '{{service_name}}': 'Hot Desk Monthly'
      };

      Object.entries(sampleData).forEach(([variable, value]) => {
        testBodyHtml = testBodyHtml.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
      });

      const success = await oneSignalEmailService.sendTestEmail(
        partnerEmail,
        bannerUrl,
        testBodyHtml
      );

      if (success) {
        toast.success('Email di test inviata con successo!');
      } else {
        toast.error('Errore durante l\'invio dell\'email di test. Verifica la configurazione OneSignal.');
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      toast.error('Errore durante l\'invio dell\'email di test.');
    } finally {
      setSendingTest(false);
    }
  };

  useEffect(() => {
    loadTemplate();
    loadPartnerData();
    loadBannerUrl();
  }, [template.id, partnerUuid]);


  const loadTemplate = async () => {
    setLoading(true);
    try {
      // Try to load existing template
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('partner_uuid', partnerUuid)
        .eq('template_type', template.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading template:', error);
      }

      if (data) {
        // Use saved template
        setSubject(data.subject_line);
        setBodyHtml(data.body_html);
        // Set editor content directly
        if (editorRef.current) {
          editorRef.current.innerHTML = data.body_html;
        }
      } else {
        // Use default template
        setSubject(defaultTemplate.subject);
        setBodyHtml(defaultTemplate.body);
        // Set editor content directly
        if (editorRef.current) {
          editorRef.current.innerHTML = defaultTemplate.body;
        }
      }
    } catch (error) {
      console.error('Error loading template:', error);
      // Use default on error
      setSubject(defaultTemplate.subject);
      setBodyHtml(defaultTemplate.body);
      // Set editor content directly
      if (editorRef.current) {
        editorRef.current.innerHTML = defaultTemplate.body;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!subject.trim()) {
      toast.error(t('emailTemplates.subjectRequired'));
      return;
    }

    if (!bodyHtml.trim()) {
      toast.error(t('emailTemplates.bodyRequired'));
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        partner_uuid: partnerUuid,
        template_type: template.id,
        subject_line: subject,
        body_html: bodyHtml
      };

      const { error } = await supabase
        .from('email_templates')
        .upsert(templateData, {
          onConflict: 'partner_uuid,template_type'
        });

      if (error) throw error;

      toast.success(t('emailTemplates.templateSavedSuccessfully'));
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(t('emailTemplates.errorSavingTemplate'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm(t('emailTemplates.confirmResetTemplate'))) {
      setSubject(defaultTemplate.subject);
      setBodyHtml(defaultTemplate.body);
      // Set editor content directly
      if (editorRef.current) {
        editorRef.current.innerHTML = defaultTemplate.body;
      }
      toast.success(t('emailTemplates.templateReset'));
    }
  };

  const insertVariable = (variable) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Focus editor
    editor.focus();

    // Insert variable at cursor position
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(variable);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // If no selection, append at end
      editor.innerHTML += variable;
    }

    // Update state
    setBodyHtml(editor.innerHTML);
  };

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setBodyHtml(editorRef.current.innerHTML);
    }
  };

  const renderPreview = () => {
    let previewHtml = bodyHtml;
    
    // Replace variables with sample data for preview
    const sampleData = {
      '{{partner_name}}': 'Your Company',
      '{{customer_name}}': 'John Doe',
      '{{admin_name}}': 'Jane Smith',
      '{{invitation_link}}': '#',
      '{{custom_message}}': 'Welcome to our platform!',
      '{{booking_date}}': 'Monday, December 15, 2024',
      '{{resource}}': 'Meeting Room A',
      '{{remaining_count}}': '5',
      '{{service_name}}': 'Hot Desk Monthly'
    };

    Object.entries(sampleData).forEach(([variable, value]) => {
      previewHtml = previewHtml.replace(new RegExp(variable, 'g'), `<strong>${value}</strong>`);
    });

    return previewHtml;
  };

  if (loading) {
    return (
      <div className="email-template-editor-loading">
        <div className="loading-spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }


  return (
    <div className="email-template-editor">
      {/* Header */}
      <div className="email-template-editor-header">
        <button onClick={onBack} className="back-button">
          <ArrowLeft size={20} />
          {t('common.back')}
        </button>
        <h2 className="email-template-editor-title">
          {t(template.nameKey)}
        </h2>
        <p className="email-template-editor-description">
          {t(template.descriptionKey)}
        </p>
      </div>

      {/* Main Content */}
      <div className="email-template-editor-content">
        {/* Editor Section */}
        <div className="email-template-editor-main">
          {/* Subject Line */}
          <div className="template-field">
            <label htmlFor="subject" className="template-field-label">
              {t('emailTemplates.subjectLine')} *
            </label>
            <input
              id="subject"
              type="text"
              className="template-subject-input"
              placeholder={t('emailTemplates.subjectPlaceholder')}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <p className="template-field-hint">
              {t('emailTemplates.subjectHint')}
            </p>
          </div>

          {/* Body Editor */}
          <div className="template-field">
            <label className="template-field-label">
              {t('emailTemplates.emailBody')} *
            </label>
            
            {/* Toolbar */}
            <div className="template-editor-toolbar">
              <button
                type="button"
                onClick={() => execCommand('bold')}
                className="toolbar-btn"
                title={t('emailTemplates.bold')}
              >
                <Bold size={18} />
              </button>
              <button
                type="button"
                onClick={() => execCommand('italic')}
                className="toolbar-btn"
                title={t('emailTemplates.italic')}
              >
                <Italic size={18} />
              </button>
              <button
                type="button"
                onClick={() => execCommand('formatBlock', '<h2>')}
                className="toolbar-btn"
                title={t('emailTemplates.heading')}
              >
                <Type size={18} />
              </button>
              <div className="toolbar-divider"></div>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className={`toolbar-btn ${showPreview ? 'active' : ''}`}
                title={t('emailTemplates.preview')}
              >
                <Eye size={18} />
              </button>
            </div>

            {/* Editor */}
            {!showPreview ? (
              <div
                ref={editorRef}
                className="template-editor"
                contentEditable
                onInput={handleEditorInput}
                suppressContentEditableWarning={true}
              >
                {/* Content will be set via ref */}
              </div>
            ) : (
              <div 
                className="template-preview"
                dangerouslySetInnerHTML={{ __html: renderPreview() }}
              />
            )}
          </div>

          {/* Actions */}
          <div className="template-editor-actions">
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary"
              disabled={saving || sendingTest}
            >
              {t('emailTemplates.resetToDefault')}
            </button>
            <button
              type="button"
              onClick={handleSendTest}
              className="btn-secondary"
              disabled={saving || sendingTest || !bodyHtml.trim()}
            >
              {sendingTest ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Invio in corso...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Invio test mail
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary"
              disabled={saving || sendingTest}
            >
              {saving ? (
                <>
                  <div className="loading-spinner-small"></div>
                  {t('common.saving')}...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {t('emailTemplates.saveTemplate')}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Variables Sidebar */}
        <div className="email-template-variables">
          <h3 className="variables-title">
            {t('emailTemplates.availableVariables')}
          </h3>
          <p className="variables-description">
            {t('emailTemplates.variablesDescription')}
          </p>
          
          <div className="variables-list">
            {defaultTemplate.variables.map((variable) => (
              <button
                key={variable.name}
                className="variable-item"
                onClick={() => insertVariable(variable.name)}
                type="button"
              >
                <code className="variable-code">{variable.name}</code>
                <span className="variable-description">{variable.description}</span>
              </button>
            ))}
          </div>

          <div className="variables-hint">
            <p className="hint-title">{t('emailTemplates.tip')}</p>
            <p className="hint-text">{t('emailTemplates.variablesTip')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailTemplateEditor;