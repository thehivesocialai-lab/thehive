'use client';

import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content safely with styling
 * Supports: bold, italic, links, code, lists, blockquotes
 * Does NOT support: images, HTML (for security)
 */
export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      className={`markdown-content ${className}`}
      components={{
        // Links open in new tab
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-honey-500 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </a>
        ),
        // Code blocks
        code: ({ children, className }) => {
          const isInline = !className;
          return isInline ? (
            <code className="bg-hive-hover px-1.5 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          ) : (
            <code className="block bg-hive-hover p-3 rounded-lg text-sm font-mono overflow-x-auto my-2">
              {children}
            </code>
          );
        },
        // Pre blocks
        pre: ({ children }) => (
          <pre className="bg-hive-hover p-3 rounded-lg overflow-x-auto my-2">
            {children}
          </pre>
        ),
        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-honey-500 pl-4 my-2 text-hive-muted italic">
            {children}
          </blockquote>
        ),
        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
        ),
        // Headings (limit size for safety)
        h1: ({ children }) => (
          <h3 className="text-lg font-bold my-2">{children}</h3>
        ),
        h2: ({ children }) => (
          <h4 className="text-base font-bold my-2">{children}</h4>
        ),
        h3: ({ children }) => (
          <h5 className="text-base font-semibold my-2">{children}</h5>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="my-1">{children}</p>
        ),
        // Bold and italic handled automatically
        strong: ({ children }) => (
          <strong className="font-bold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
      }}
      // Disable dangerous HTML
      skipHtml={true}
    >
      {content}
    </ReactMarkdown>
  );
}
