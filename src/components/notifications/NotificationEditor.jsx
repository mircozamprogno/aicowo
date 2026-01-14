// src/components/notifications/NotificationEditor.jsx
import { Bold, Eye, Italic, Link as LinkIcon, Type } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';

const NotificationEditor = ({ value, onChange, showPreview = false, onTogglePreview, sampleData = {} }) => {
  const { t } = useTranslation();
  const editorRef = useRef(null);
  const isTypingRef = useRef(false);

  // Sync content when not typing
  useEffect(() => {
    if (editorRef.current && value && !showPreview && !isTypingRef.current) {
      editorRef.current.innerHTML = value;
    }
  }, [value, showPreview]);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();

    if (editorRef.current) {
      isTypingRef.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const insertLink = () => {
    const url = prompt(t('notifications.enterLinkUrl') || 'Enter URL:');
    if (!url) return;

    const selection = window.getSelection();
    let linkText = prompt(t('notifications.enterLinkText') || 'Enter link text:');

    if (!linkText) {
      linkText = url;
    }

    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    // Create the link HTML
    const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #4f46e5; text-decoration: underline;">${linkText}</a>`;

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = linkHtml;
      const linkNode = tempDiv.firstChild;
      range.insertNode(linkNode);
      range.setStartAfter(linkNode);
      range.setEndAfter(linkNode);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editor.innerHTML += linkHtml;
    }

    isTypingRef.current = true;
    onChange(editor.innerHTML);
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      isTypingRef.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const renderPreview = () => {
    let previewHtml = value;

    // Replace sample data variables
    Object.entries(sampleData).forEach(([variable, replaceValue]) => {
      previewHtml = previewHtml.replace(
        new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'),
        `<strong>${replaceValue}</strong>`
      );
    });

    return previewHtml;
  };

  return (
    <div className="notification-editor-container">
      <div className="notification-editor-toolbar">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="toolbar-btn"
          title={t('notifications.bold')}
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="toolbar-btn"
          title={t('notifications.italic')}
        >
          <Italic size={18} />
        </button>
        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<h2>')}
          className="toolbar-btn"
          title={t('notifications.heading')}
        >
          <Type size={18} />
        </button>
        <button
          type="button"
          onClick={insertLink}
          className="toolbar-btn"
          title={t('notifications.insertLink')}
        >
          <LinkIcon size={18} />
        </button>
        <div className="toolbar-divider"></div>
        <button
          type="button"
          onClick={onTogglePreview}
          className={`toolbar-btn ${showPreview ? 'active' : ''}`}
          title={t('notifications.preview')}
        >
          <Eye size={18} />
        </button>
      </div>

      {!showPreview ? (
        <div
          ref={editorRef}
          className="notification-editor"
          contentEditable
          onInput={handleEditorInput}
          suppressContentEditableWarning={true}
        />
      ) : (
        <div
          className="notification-preview"
          dangerouslySetInnerHTML={{ __html: renderPreview() }}
        />
      )}
    </div>
  );
};

export default NotificationEditor;