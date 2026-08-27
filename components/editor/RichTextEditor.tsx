'use client'

import { useState, useRef, useCallback } from 'react'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

type Tab = 'wysiwyg' | 'html'

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const [tab, setTab] = useState<Tab>('wysiwyg')
  const editorRef = useRef<HTMLDivElement>(null)

  const execCmd = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const insertLink = () => {
    const url = window.prompt('Enter URL:', 'https://')
    if (url) execCmd('createLink', url)
  }

  const insertImage = () => {
    const url = window.prompt('Enter image URL:', 'https://')
    if (url) execCmd('insertImage', url)
  }

  const handleWysiwygInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const handleHtmlInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className="border-2 border-joy-gray-200 rounded-xl overflow-hidden focus-within:border-joy-orange">
      {/* Tab Switcher */}
      <div className="bg-joy-gray-50 px-3 py-1.5 flex gap-1 border-b border-joy-gray-200">
        <button
          type="button"
          onClick={() => setTab('wysiwyg')}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'wysiwyg' ? 'bg-joy-orange text-white' : 'text-joy-gray-600 hover:bg-joy-gray-200'
          }`}
        >
          WYSIWYG
        </button>
        <button
          type="button"
          onClick={() => setTab('html')}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'html' ? 'bg-joy-orange text-white' : 'text-joy-gray-600 hover:bg-joy-gray-200'
          }`}
        >
          HTML Source
        </button>
      </div>

      {/* Toolbar - only show in WYSIWYG mode */}
      {tab === 'wysiwyg' && (
        <div className="bg-joy-gray-50 px-3 py-2 flex flex-wrap gap-1 border-b border-joy-gray-200">
          <button type="button" onClick={() => execCmd('formatBlock', 'h2')} className="px-2 py-1 text-sm font-bold hover:bg-joy-gray-200 rounded">H2</button>
          <button type="button" onClick={() => execCmd('formatBlock', 'h3')} className="px-2 py-1 text-sm font-bold hover:bg-joy-gray-200 rounded">H3</button>
          <button type="button" onClick={() => execCmd('formatBlock', 'p')} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">P</button>
          <div className="w-px h-6 bg-joy-gray-300 mx-1 self-center" />
          <button type="button" onClick={() => execCmd('bold')} className="px-2 py-1 text-sm font-bold hover:bg-joy-gray-200 rounded">B</button>
          <button type="button" onClick={() => execCmd('italic')} className="px-2 py-1 text-sm italic hover:bg-joy-gray-200 rounded">I</button>
          <button type="button" onClick={() => execCmd('underline')} className="px-2 py-1 text-sm underline hover:bg-joy-gray-200 rounded">U</button>
          <button type="button" onClick={() => execCmd('strikethrough')} className="px-2 py-1 text-sm line-through hover:bg-joy-gray-200 rounded">S</button>
          <div className="w-px h-6 bg-joy-gray-300 mx-1 self-center" />
          <button type="button" onClick={() => execCmd('insertUnorderedList')} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">• List</button>
          <button type="button" onClick={() => execCmd('insertOrderedList')} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">1. List</button>
          <div className="w-px h-6 bg-joy-gray-300 mx-1 self-center" />
          <button type="button" onClick={insertLink} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">Link</button>
          <button type="button" onClick={insertImage} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">Image</button>
          <div className="w-px h-6 bg-joy-gray-300 mx-1 self-center" />
          <button type="button" onClick={() => execCmd('formatBlock', 'blockquote')} className="px-2 py-1 text-sm italic hover:bg-joy-gray-200 rounded">Quote</button>
          <button type="button" onClick={() => execCmd('insertHorizontalRule')} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">HR</button>
          <div className="w-px h-6 bg-joy-gray-300 mx-1 self-center" />
          <button type="button" onClick={() => execCmd('undo')} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">↩ Undo</button>
          <button type="button" onClick={() => execCmd('redo')} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">↪ Redo</button>
        </div>
      )}

      {/* Editor Area */}
      {tab === 'wysiwyg' ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleWysiwygInput}
          className="min-h-[280px] px-4 py-3 prose prose-sm max-w-none focus:outline-none"
          dangerouslySetInnerHTML={{ __html: content }}
          data-placeholder={placeholder || 'Start typing...'}
        />
      ) : (
        <textarea
          className="w-full min-h-[280px] px-4 py-3 font-mono text-sm border-0 focus:ring-0 resize-y"
          value={content}
          onChange={handleHtmlInput}
          placeholder={placeholder || '<h2>Your HTML content here...</p>'}
          spellCheck={false}
        />
      )}
    </div>
  )
}
