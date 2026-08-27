'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { useEffect } from 'react'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-joy-orange underline' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'max-w-full h-auto' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[250px] px-4 py-3',
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '')
    }
  }, [content, editor])

  if (!editor) return null

  const addLink = () => {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const addImage = () => {
    const url = window.prompt('Enter image URL:')
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }

  return (
    <div className="border-2 border-joy-gray-200 rounded-xl overflow-hidden focus-within:border-joy-orange">
      {/* Toolbar */}
      <div className="bg-joy-gray-50 px-3 py-2 flex flex-wrap gap-1 border-b border-joy-gray-200">
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 py-1 text-sm font-bold hover:bg-joy-gray-200 rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-joy-gray-200 text-joy-orange' : ''}`}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`px-2 py-1 text-sm font-bold hover:bg-joy-gray-200 rounded ${editor.isActive('heading', { level: 3 }) ? 'bg-joy-gray-200 text-joy-orange' : ''}`}>H3</button>
        <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} className={`px-2 py-1 text-sm hover:bg-joy-gray-200 rounded ${editor.isActive('paragraph') ? 'bg-joy-gray-200 text-joy-orange' : ''}`}>P</button>
        <div className="w-px h-6 bg-joy-gray-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`px-2 py-1 text-sm font-bold hover:bg-joy-gray-200 rounded ${editor.isActive('bold') ? 'bg-joy-gray-200 text-joy-orange' : ''}`}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-2 py-1 text-sm italic hover:bg-joy-gray-200 rounded ${editor.isActive('italic') ? 'bg-joy-gray-200 text-joy-orange' : ''}`}>I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`px-2 py-1 text-sm underline hover:bg-joy-gray-200 rounded ${editor.isActive('underline') ? 'bg-joy-gray-200 text-joy-orange' : ''}`}>U</button>
        <div className="w-px h-6 bg-joy-gray-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-2 py-1 text-sm hover:bg-joy-gray-200 rounded ${editor.isActive('bulletList') ? 'bg-joy-gray-200 text-joy-orange' : ''}`}>• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`px-2 py-1 text-sm hover:bg-joy-gray-200 rounded ${editor.isActive('orderedList') ? 'bg-joy-gray-200 text-joy-orange' : ''}`}>1. List</button>
        <div className="w-px h-6 bg-joy-gray-300 mx-1" />
        <button type="button" onClick={addLink} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">Link</button>
        <button type="button" onClick={addImage} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">Image</button>
        <div className="w-px h-6 bg-joy-gray-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`px-2 py-1 text-sm italic hover:bg-joy-gray-200 rounded ${editor.isActive('blockquote') ? 'bg-joy-gray-200 text-joy-orange' : ''}`}>Quote</button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded">HR</button>
        <div className="w-px h-6 bg-joy-gray-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().undo().run()} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded" disabled={!editor.can().undo()}>Undo</button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} className="px-2 py-1 text-sm hover:bg-joy-gray-200 rounded" disabled={!editor.can().redo()}>Redo</button>
      </div>
      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}
