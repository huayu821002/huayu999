'use client'

import { useMemo } from 'react'
import { CKEditor } from '@ckeditor/ckeditor5-react'
import {
  ClassicEditor,
  Essentials,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Paragraph,
  Heading,
  List,
  FontFamily,
  FontSize,
  TextAlign,
  Link,
  Image,
  ImageResize,
  Table,
  TableToolbar,
  BlockQuote,
  CodeBlock,
  HorizontalLine,
  SpecialCharacters,
  Subscript,
  Superscript,
  Undo,
  Redo,
  FindAndReplace,
  RemoveFormat,
  SourceEditing,
} from '@ckeditor/ckeditor5'
import '@ckeditor/ckeditor5/ckeditor5.css'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editorConfig = useMemo(() => ({
    toolbar: {
      items: [
        'sourceEditing', '|',
        'undo', 'redo', '|',
        'findAndReplace', '|',
        'heading', '|',
        'fontFamily', 'fontSize', '|',
        'bold', 'italic', 'underline', 'strikethrough', '|',
        'subscript', 'superscript', '|',
        'removeFormat', '|',
        'bulletedList', 'numberedList', '|',
        'alignment', '|',
        'link', 'image', '|',
        'blockQuote', 'codeBlock', 'horizontalLine', '|',
        'specialCharacters', '|',
        'insertTable', '|',
      ],
      shouldNotGroupWhenFull: true,
    },
    plugins: [
      Essentials,
      Bold,
      Italic,
      Underline,
      Strikethrough,
      Paragraph,
      Heading,
      List,
      FontFamily,
      FontSize,
      TextAlign,
      Link,
      Image,
      ImageResize,
      Table,
      TableToolbar,
      BlockQuote,
      CodeBlock,
      HorizontalLine,
      SpecialCharacters,
      Subscript,
      Superscript,
      Undo,
      Redo,
      FindAndReplace,
      RemoveFormat,
      SourceEditing,
    ],
    initialData: content || '',
    link: {
      addTargetToExternalLinks: true,
    },
    image: {
      resizeOptions: [
        { name: 'resizeImage:original', label: 'Original', value: null },
        { name: 'resizeImage:50', label: '50%', value: 'medium' },
        { name: 'resizeImage:75', label: '75%', value: 'large' },
      ],
      toolbar: [
        'imageTextAlternative',
        'toggleImageCaption',
        'imageStyle:inline',
        'imageStyle:block',
        'imageStyle:side',
        '|',
        'resizeImage',
      ],
    },
    table: {
      contentToolbar: [
        'tableColumn',
        'tableRow',
        'mergeTableCells',
        'tableProperties',
        'tableCellProperties',
      ],
    },
    placeholder: placeholder || 'Start typing...',
  }), [])

  return (
    <div className="ck-editor-wrapper border-2 border-joy-gray-200 rounded-xl overflow-hidden focus-within:border-joy-orange">
      <CKEditor
        editor={ClassicEditor}
        config={editorConfig}
        data={content || ''}
        onChange={(_event, editor) => {
          onChange(editor.getData())
        }}
      />
    </div>
  )
}
